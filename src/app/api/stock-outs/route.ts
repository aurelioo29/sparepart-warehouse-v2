import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type StockOutItemBody = {
  productId?: string;
  warehouseId?: string | null;
  rackLocationId?: string | null;
  quantity?: number | string;
  unitPrice?: number | string | null;
  notes?: string | null;
};

type CreateStockOutBody = {
  documentNumber?: string | null;
  stockOutDate?: string | null;
  reason?: string | null;
  notes?: string | null;
  items?: StockOutItemBody[];
};

const stockOutReasons = [
  "INTERNAL_USE",
  "DAMAGED",
  "LOST",
  "RETURN_TO_SUPPLIER",
  "OTHER",
] as const;

const stockOutStatuses = ["DRAFT", "POSTED", "CANCELLED"] as const;

type StockOutReasonValue = (typeof stockOutReasons)[number];
type StockOutStatusValue = (typeof stockOutStatuses)[number];

function isStockOutReason(value: string): value is StockOutReasonValue {
  return stockOutReasons.includes(value as StockOutReasonValue);
}

function isStockOutStatus(value: string): value is StockOutStatusValue {
  return stockOutStatuses.includes(value as StockOutStatusValue);
}

function parseDate(value: unknown) {
  if (!value) return new Date();

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal barang keluar tidak valid");
  }

  return date;
}

function parseInteger(value: unknown, fieldName: string) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${fieldName} harus berupa angka bulat lebih dari 0`);
  }

  return numberValue;
}

function parseDecimal(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue) || numberValue < 0) {
    throw new Error("Harga harus berupa angka minimal 0");
  }

  return numberValue;
}

function nullableId(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : null;
}

async function generateStockOutDocumentNumber(tx: Prisma.TransactionClient) {
  const today = new Date();

  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  const prefix = `OUT-${yyyy}${mm}${dd}`;

  const count = await tx.stockOut.count({
    where: {
      documentNumber: {
        startsWith: prefix,
      },
    },
  });

  const sequence = String(count + 1).padStart(4, "0");

  return `${prefix}-${sequence}`;
}

function getStockOutOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.StockOutOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "documentNumber":
      return { documentNumber: order };

    case "stockOutDate":
      return { stockOutDate: order };

    case "reason":
      return { reason: order };

    case "totalAmount":
      return { totalAmount: order };

    case "status":
      return { status: order };

    case "updatedAt":
      return { updatedAt: order };

    case "createdAt":
    default:
      return { createdAt: order };
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("stock_outs.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);

    const search = (searchParams.get("search") || "").trim();
    const reason = (searchParams.get("reason") || "").trim();
    const status = (searchParams.get("status") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = Number.isNaN(limit) || limit < 1 ? 10 : limit;
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.StockOutWhereInput = {};

    if (search) {
      where.OR = [
        {
          documentNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          notes: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (reason) {
      if (!isStockOutReason(reason)) {
        return errorResponse({
          message: "Reason barang keluar tidak valid",
          status: 400,
        });
      }

      where.reason = reason;
    }

    if (status) {
      if (!isStockOutStatus(status)) {
        return errorResponse({
          message: "Status barang keluar tidak valid",
          status: 400,
        });
      }

      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.stockOutDate = {};

      if (dateFrom) {
        where.stockOutDate.gte = new Date(dateFrom);
      }

      if (dateTo) {
        where.stockOutDate.lte = new Date(dateTo);
      }
    }

    const [items, total] = await prisma.$transaction([
      prisma.stockOut.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
        orderBy: getStockOutOrderBy(sortBy, sortOrder),
        skip,
        take: safeLimit,
      }),

      prisma.stockOut.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Stock out retrieved successfully",
      data: {
        items,
        meta: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/stock-outs error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to fetch stock out",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("stock_outs.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const body = (await req.json()) as CreateStockOutBody;

    const stockOutDate = parseDate(body.stockOutDate);
    const reason = body.reason?.trim() || "OTHER";
    const notes = body.notes?.trim() || null;
    const items = body.items || [];

    if (!isStockOutReason(reason)) {
      return errorResponse({
        message: "Reason barang keluar tidak valid",
        status: 400,
      });
    }

    if (items.length === 0) {
      return errorResponse({
        message: "Minimal harus ada 1 item barang keluar",
        status: 400,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let documentNumber = body.documentNumber?.trim().toUpperCase() || "";

      if (!documentNumber) {
        documentNumber = await generateStockOutDocumentNumber(tx);
      }

      const duplicateDocument = await tx.stockOut.findUnique({
        where: {
          documentNumber,
        },
        select: {
          id: true,
        },
      });

      if (duplicateDocument) {
        throw new Error("Nomor dokumen barang keluar sudah digunakan");
      }

      const normalizedItems = items.map((item, index) => {
        const productId = item.productId?.trim();
        const warehouseId = nullableId(item.warehouseId);
        const rackLocationId = nullableId(item.rackLocationId);
        const quantity = parseInteger(
          item.quantity,
          `Quantity item ${index + 1}`,
        );
        const unitPrice = parseDecimal(item.unitPrice, 0);
        const totalPrice = quantity * unitPrice;
        const itemNotes = item.notes?.trim() || null;

        if (!productId) {
          throw new Error(`Product item ${index + 1} wajib dipilih`);
        }

        return {
          productId,
          warehouseId,
          rackLocationId,
          quantity,
          unitPrice,
          totalPrice,
          notes: itemNotes,
        };
      });

      const totalAmount = normalizedItems.reduce(
        (total, item) => total + item.totalPrice,
        0,
      );

      const stockOut = await tx.stockOut.create({
        data: {
          documentNumber,
          stockOutDate,
          reason,
          status: "POSTED",
          totalAmount,
          notes,
          createdById: currentUser.id,
          postedAt: new Date(),
        },
      });

      for (const item of normalizedItems) {
        const product = await tx.product.findUnique({
          where: {
            id: item.productId,
          },
          select: {
            id: true,
            name: true,
            currentStock: true,
          },
        });

        if (!product) {
          throw new Error("Product tidak ditemukan");
        }

        if (product.currentStock < item.quantity) {
          throw new Error(
            `Stock product "${product.name}" tidak cukup. Tersedia: ${product.currentStock}`,
          );
        }

        if (item.warehouseId) {
          const warehouse = await tx.warehouse.findUnique({
            where: {
              id: item.warehouseId,
            },
            select: {
              id: true,
            },
          });

          if (!warehouse) {
            throw new Error("Warehouse tidak ditemukan");
          }
        }

        if (item.rackLocationId) {
          const rackLocation = await tx.rackLocation.findUnique({
            where: {
              id: item.rackLocationId,
            },
            select: {
              id: true,
              warehouseId: true,
            },
          });

          if (!rackLocation) {
            throw new Error("Rack location tidak ditemukan");
          }

          if (
            item.warehouseId &&
            rackLocation.warehouseId !== item.warehouseId
          ) {
            throw new Error("Rack location tidak sesuai dengan warehouse");
          }
        }

        const stockBefore = product.currentStock;
        const stockAfter = stockBefore - item.quantity;

        await tx.stockOutItem.create({
          data: {
            stockOutId: stockOut.id,
            productId: item.productId,
            warehouseId: item.warehouseId,
            rackLocationId: item.rackLocationId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            notes: item.notes,
          },
        });

        await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            currentStock: {
              decrement: item.quantity,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: item.warehouseId,
            rackLocationId: item.rackLocationId,
            type: "OUT",
            quantity: item.quantity,
            stockBefore,
            stockAfter,
            referenceType: "STOCK_OUT",
            referenceId: stockOut.id,
            notes: `Barang keluar ${documentNumber}`,
            createdById: currentUser.id,
          },
        });
      }

      return tx.stockOut.findUnique({
        where: {
          id: stockOut.id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
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
            },
          },
        },
      });
    });

    if (!result) {
      return errorResponse({
        message: "Gagal membuat barang keluar",
        status: 500,
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        module: "stock_outs",
        resourceType: "stock_outs",
        resourceId: result.id,
        oldData: Prisma.JsonNull,
        newData: result,
      },
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "CREATE",
      module: "stock_outs",
      relatedId: result.id,
      title: "Stock Out Created",
      message: `${currentUser.name || "Someone"} created stock out ${
        result.documentNumber
      }.`,
    });

    return successResponse({
      message: "Stock out created successfully",
      data: result,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/stock-outs error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to create stock out",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
