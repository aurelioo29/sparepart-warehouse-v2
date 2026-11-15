import "server-only";

import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import {
  closingStock,
  currentPeriod,
  nextPeriod,
  parsePeriod,
} from "@/lib/inventory/monthly-core";

import type {
  InventoryFilters,
  InventoryPeriod,
  InventoryRow,
  InventoryStockStatus,
} from "@/lib/inventory/types";

export class InventoryPeriodError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);

    this.name = "InventoryPeriodError";
    this.status = status;
  }
}

const inventoryProductInclude = {
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
    },
  },
  unit: {
    select: {
      id: true,
      name: true,
      shortName: true,
    },
  },
  supplier: {
    select: {
      id: true,
      name: true,
    },
  },
  warehouse: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  rackLocation: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
} satisfies Prisma.ProductInclude;

type InventoryProduct = Prisma.ProductGetPayload<{
  include: typeof inventoryProductInclude;
}>;

function makeInventoryRow(
  product: InventoryProduct,
  quantity = product.currentStock,
): InventoryRow {
  const purchasePrice = Number(product.purchasePrice || 0);
  const sellingPrice = Number(product.sellingPrice || 0);
  const minStock = product.minStock || 0;

  let stockStatus: InventoryStockStatus = "NORMAL";

  if (quantity === 0) {
    stockStatus = "OUT_OF_STOCK";
  } else if (quantity <= minStock) {
    stockStatus = "LOW_STOCK";
  }

  return {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode || "",
    productName: product.name,

    category: product.category?.name || "-",
    brand: product.brand?.name || "-",
    unit: product.unit?.shortName || "-",
    supplier: product.supplier?.name || "-",
    warehouse: product.warehouse?.name || "-",
    rackLocation: product.rackLocation?.name || "-",

    currentStock: quantity,
    minStock,

    purchasePrice,
    sellingPrice,

    purchaseStockValue: quantity * purchasePrice,
    sellingStockValue: quantity * sellingPrice,

    stockStatus,
  };
}

function getFirstSnapshotPeriod() {
  const value = process.env.INVENTORY_SNAPSHOT_START_MONTH?.trim();

  if (!value) {
    throw new Error("INVENTORY_SNAPSHOT_START_MONTH belum dikonfigurasi.");
  }

  parsePeriod(value);

  return value;
}

export async function getLiveInventory(
  filters: InventoryFilters,
): Promise<InventoryRow[]> {
  const where: Prisma.ProductWhereInput = {
    isActive: true,
  };

  if (filters.search) {
    where.OR = [
      {
        sku: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      {
        barcode: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      {
        name: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      {
        category: {
          name: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
      },
      {
        brand: {
          name: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
      },
    ];
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.brandId) {
    where.brandId = filters.brandId;
  }

  if (filters.warehouseId) {
    where.warehouseId = filters.warehouseId;
  }

  const products = await prisma.product.findMany({
    where,
    include: inventoryProductInclude,
    orderBy: [
      {
        category: {
          name: "asc",
        },
      },
      {
        name: "asc",
      },
      {
        sku: "asc",
      },
    ],
  });

  return products.map((product) => makeInventoryRow(product));
}

export async function closeInventoryMonth(period: string) {
  const { cutoff } = parsePeriod(period);

  if (process.env.INVENTORY_MOVEMENT_AUDIT_CONFIRMED !== "true") {
    throw new Error(
      "Pastikan seluruh perubahan stok tercatat lengkap di StockMovement, " +
        "kemudian aktifkan INVENTORY_MOVEMENT_AUDIT_CONFIRMED.",
    );
  }

  const firstPeriod = getFirstSnapshotPeriod();

  if (period < firstPeriod) {
    throw new Error("Periode lebih awal dari bulan awal snapshot.");
  }

  if (period >= currentPeriod()) {
    throw new Error("Bulan berjalan atau bulan depan belum dapat ditutup.");
  }

  const maxAttempts = 4;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existing = await tx.inventoryMonthlySnapshot.findUnique({
            where: {
              period,
            },
          });

          // Snapshot yang sudah tersimpan tidak ditimpa.
          if (existing) {
            return {
              period,
              created: false,
            };
          }

          /*
           * Hitung seluruh perubahan stok sejak awal bulan berikutnya.
           *
           * Pakai stockAfter - stockBefore agar:
           * - stok masuk
           * - stok keluar
           * - adjustment
           * - pembatalan / reversal
           *
           * tetap dihitung sebagai delta bertanda.
           */
          const laterMovements = await tx.stockMovement.groupBy({
            by: ["productId"],
            where: {
              createdAt: {
                gte: cutoff,
              },
            },
            _sum: {
              stockBefore: true,
              stockAfter: true,
            },
          });

          const movementMap = new Map(
            laterMovements.map((movement) => [
              movement.productId,
              movement._sum,
            ]),
          );

          /*
           * Termasuk produk nonaktif.
           * Produk yang baru dibuat bulan berikutnya tidak dimasukkan.
           */
          const products = await tx.product.findMany({
            where: {
              createdAt: {
                lt: cutoff,
              },
            },
            include: inventoryProductInclude,
          });

          const rows = products.map((product) => {
            const movement = movementMap.get(product.id);

            const quantity = closingStock(
              product.currentStock,
              movement?.stockBefore ?? 0,
              movement?.stockAfter ?? 0,
            );

            return makeInventoryRow(product, quantity);
          });

          const snapshot = await tx.inventoryMonthlySnapshot.create({
            data: {
              period,
              cutoffAt: cutoff,
            },
          });

          // Insert bertahap untuk menghindari batas parameter SQL.
          const chunkSize = 500;

          for (let offset = 0; offset < rows.length; offset += chunkSize) {
            const chunk = rows.slice(offset, offset + chunkSize);

            await tx.inventoryMonthlySnapshotItem.createMany({
              data: chunk.map((row, index) => {
                const product = products[offset + index];

                return {
                  snapshotId: snapshot.id,
                  productId: product.id,

                  categoryId: product.categoryId,
                  brandId: product.brandId,
                  warehouseId: product.warehouseId,

                  closingStock: row.currentStock,

                  data: {
                    ...row,
                  },
                };
              }),
            });
          }

          return {
            period,
            created: true,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 60000,
        },
      );
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code);

      if (!retryable || attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }

  throw new Error("Gagal menyimpan snapshot setelah beberapa percobaan.");
}

export async function closePendingInventoryMonths() {
  let period = getFirstSnapshotPeriod();

  const current = currentPeriod();

  const completed = await prisma.inventoryMonthlySnapshot.findMany({
    select: {
      period: true,
    },
  });

  const existingPeriods = new Set(completed.map((snapshot) => snapshot.period));

  const results: {
    period: string;
    created: boolean;
  }[] = [];

  /*
   * Cari bulan yang belum tersimpan mulai bulan awal.
   *
   * Maksimal 12 periode baru setiap pemanggilan.
   * Jika tertinggal lebih banyak, panggil lagi.
   */
  while (period < current && results.length < 12) {
    if (!existingPeriods.has(period)) {
      const result = await closeInventoryMonth(period);

      results.push(result);
    }

    period = nextPeriod(period);
  }

  return {
    results,
    morePending: period < current,
  };
}

export async function getMonthlyInventory(
  period: string,
  filters: InventoryFilters,
): Promise<{
  items: InventoryRow[];
  period: InventoryPeriod;
}> {
  let bounds: ReturnType<typeof parsePeriod>;

  try {
    bounds = parsePeriod(period);
  } catch {
    throw new InventoryPeriodError(
      "Periode harus YYYY-MM, contoh 2026-10.",
      400,
    );
  }

  if (period >= currentPeriod()) {
    throw new InventoryPeriodError(
      "Pilih bulan yang sudah berakhir, atau gunakan stok saat ini.",
      400,
    );
  }

  const snapshot = await prisma.inventoryMonthlySnapshot.findUnique({
    where: {
      period,
    },
  });

  if (!snapshot) {
    throw new InventoryPeriodError(
      "Rekap bulan ini belum tersedia. Jalankan proses rekap terlebih dahulu.",
      404,
    );
  }

  const storedItems = await prisma.inventoryMonthlySnapshotItem.findMany({
    where: {
      snapshotId: snapshot.id,

      ...(filters.categoryId
        ? {
            categoryId: filters.categoryId,
          }
        : {}),

      ...(filters.brandId
        ? {
            brandId: filters.brandId,
          }
        : {}),

      ...(filters.warehouseId
        ? {
            warehouseId: filters.warehouseId,
          }
        : {}),
    },
  });

  const search = filters.search.toLowerCase();

  const items = storedItems
    .map((item): InventoryRow => {
      const stored = item.data as unknown as InventoryRow;

      return {
        ...stored,
        currentStock: item.closingStock,
      };
    })
    .filter((item) => {
      if (!search) {
        return true;
      }

      return [
        item.sku,
        item.barcode,
        item.productName,
        item.category,
        item.brand,
      ].some((value) => value.toLowerCase().includes(search));
    });

  const lastDayWib = new Date(bounds.cutoff.getTime() + 7 * 60 * 60 * 1000 - 1)
    .toISOString()
    .slice(0, 10);

  return {
    items,
    period: {
      year: bounds.year,
      month: bounds.month,
      mode: "snapshot",
      dateFrom: `${period}-01`,
      dateTo: lastDayWib,
      capturedAt: snapshot.capturedAt.toISOString(),
    },
  };
}
