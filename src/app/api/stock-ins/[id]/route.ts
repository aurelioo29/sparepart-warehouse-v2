import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type StockInItemBody = {
  productId?: string;
  warehouseId?: string | null;
  rackLocationId?: string | null;
  quantity?: number | string;
  unitPrice?: number | string | null;
};

type UpdateStockInBody = {
  supplierId?: string | null;
  documentNumber?: string | null;
  invoiceNumber?: string | null;
  stockInDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  items?: StockInItemBody[];
};

type NormalizedStockInItem = {
  productId: string;
  warehouseId: string | null;
  rackLocationId: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type StockAggregateItem = {
  productId: string;
  warehouseId: string | null;
  rackLocationId: string | null;
  quantity: number;
  unitPrice: number;
};

function parseDate(value: unknown) {
  if (!value) {
    return new Date();
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal barang masuk tidak valid");
  }

  return date;
}

function parseOptionalDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal jatuh tempo tidak valid");
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
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

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

function nullableText(value: string | null | undefined) {
  const clean = value?.trim();

  return clean ? clean : null;
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value || 0);
}

function getPaymentStatus(totalAmount: number, paidAmount: number) {
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);

  if (remainingAmount <= 0) return "PAID";
  if (paidAmount > 0) return "PARTIAL";

  return "UNPAID";
}

function getStockKey(item: {
  productId: string;
  warehouseId: string | null;
  rackLocationId: string | null;
}) {
  return [
    item.productId,
    item.warehouseId || "NULL_WAREHOUSE",
    item.rackLocationId || "NULL_RACK",
  ].join("::");
}

function buildStockAggregate(items: StockAggregateItem[]) {
  const map = new Map<string, StockAggregateItem>();

  for (const item of items) {
    const key = getStockKey(item);
    const existing = map.get(key);

    if (existing) {
      map.set(key, {
        ...existing,
        quantity: existing.quantity + item.quantity,
        unitPrice: item.unitPrice,
      });
    } else {
      map.set(key, {
        productId: item.productId,
        warehouseId: item.warehouseId || null,
        rackLocationId: item.rackLocationId || null,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
      });
    }
  }

  return map;
}

async function validateSupplier(
  tx: Prisma.TransactionClient,
  supplierId: string | null,
) {
  if (!supplierId) return;

  const supplier = await tx.supplier.findUnique({
    where: {
      id: supplierId,
    },
    select: {
      id: true,
    },
  });

  if (!supplier) {
    throw new Error("Supplier tidak ditemukan");
  }
}

async function validateWarehouseAndRack(
  tx: Prisma.TransactionClient,
  warehouseId: string | null,
  rackLocationId: string | null,
) {
  if (warehouseId) {
    const warehouse = await tx.warehouse.findUnique({
      where: {
        id: warehouseId,
      },
      select: {
        id: true,
      },
    });

    if (!warehouse) {
      throw new Error("Warehouse tidak ditemukan");
    }
  }

  if (rackLocationId) {
    const rackLocation = await tx.rackLocation.findUnique({
      where: {
        id: rackLocationId,
      },
      select: {
        id: true,
        warehouseId: true,
      },
    });

    if (!rackLocation) {
      throw new Error("Rack location tidak ditemukan");
    }

    if (warehouseId && rackLocation.warehouseId !== warehouseId) {
      throw new Error("Rack location tidak sesuai dengan warehouse");
    }
  }
}

function normalizeItems(items: StockInItemBody[]): NormalizedStockInItem[] {
  if (items.length === 0) {
    throw new Error("Minimal harus ada 1 item barang masuk");
  }

  return items.map((item, index) => {
    const productId = item.productId?.trim();
    const warehouseId = nullableId(item.warehouseId);
    const rackLocationId = nullableId(item.rackLocationId);
    const quantity = parseInteger(item.quantity, `Quantity item ${index + 1}`);
    const unitPrice = parseDecimal(item.unitPrice, 0);
    const totalPrice = quantity * unitPrice;

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
    };
  });
}

const stockInInclude = {
  supplier: true,
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
          currentStock: true,
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
  payments: {
    include: {
      createdBy: {
        select: {
          id: true,
          fullName: true,
          username: true,
        },
      },
    },
  },
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("stock_ins.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const stockIn = await prisma.stockIn.findUnique({
      where: {
        id,
      },
      include: stockInInclude,
    });

    if (!stockIn) {
      return errorResponse({
        message: "Stock in tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Stock in retrieved successfully",
      data: stockIn,
    });
  } catch (error) {
    console.error("GET /api/stock-ins/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to fetch stock in",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("stock_ins.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;
    const { id } = await context.params;
    const body = (await req.json()) as UpdateStockInBody;

    const supplierId = nullableId(body.supplierId);
    const invoiceNumber = nullableText(body.invoiceNumber);
    const stockInDate = parseDate(body.stockInDate);
    const dueDate = parseOptionalDate(body.dueDate);
    const notes = body.notes?.trim() || null;
    const normalizedItems = normalizeItems(body.items || []);

    const totalAmount = normalizedItems.reduce(
      (total, item) => total + item.totalPrice,
      0,
    );

    const result = await prisma.$transaction(async (tx) => {
      const oldStockIn = await tx.stockIn.findUnique({
        where: {
          id,
        },
        include: {
          items: true,
          payments: true,
          supplier: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
        },
      });

      if (!oldStockIn) {
        throw new Error("Stock in tidak ditemukan");
      }

      if (oldStockIn.status === "CANCELLED") {
        throw new Error("Stock in yang sudah dibatalkan tidak bisa diedit");
      }

      const documentNumber =
        body.documentNumber?.trim().toUpperCase() || oldStockIn.documentNumber;

      if (documentNumber !== oldStockIn.documentNumber) {
        const duplicateDocument = await tx.stockIn.findUnique({
          where: {
            documentNumber,
          },
          select: {
            id: true,
          },
        });

        if (duplicateDocument && duplicateDocument.id !== oldStockIn.id) {
          throw new Error("Nomor dokumen barang masuk sudah digunakan");
        }
      }

      await validateSupplier(tx, supplierId);

      for (const item of normalizedItems) {
        const product = await tx.product.findUnique({
          where: {
            id: item.productId,
          },
          select: {
            id: true,
          },
        });

        if (!product) {
          throw new Error("Product tidak ditemukan");
        }

        await validateWarehouseAndRack(
          tx,
          item.warehouseId,
          item.rackLocationId,
        );
      }

      const oldPaidAmount = toNumber(oldStockIn.paidAmount);

      if (oldPaidAmount > totalAmount) {
        throw new Error(
          "Total barang masuk baru lebih kecil dari jumlah yang sudah dibayar. Batalkan/adjust pembayaran dulu.",
        );
      }

      const newRemainingAmount = Math.max(totalAmount - oldPaidAmount, 0);
      const newPaymentStatus = getPaymentStatus(totalAmount, oldPaidAmount);

      /**
       * DELTA STOCK LOGIC
       *
       * Ini bagian penting.
       *
       * Dulu logic-nya:
       * - rollback semua qty lama
       * - lalu masukin qty baru
       *
       * Sekarang:
       * - hanya hitung selisih antara qty lama dan qty baru
       *
       * Contoh:
       * lama 10, baru 9 => decrement 1 saja
       * lama 10, baru 12 => increment 2 saja
       */
      if (oldStockIn.status === "POSTED") {
        const oldStockMap = buildStockAggregate(
          oldStockIn.items.map((item) => ({
            productId: item.productId,
            warehouseId: item.warehouseId || null,
            rackLocationId: item.rackLocationId || null,
            quantity: Number(item.quantity || 0),
            unitPrice: toNumber(item.unitPrice),
          })),
        );

        const newStockMap = buildStockAggregate(
          normalizedItems.map((item) => ({
            productId: item.productId,
            warehouseId: item.warehouseId || null,
            rackLocationId: item.rackLocationId || null,
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
          })),
        );

        const allKeys = new Set<string>([
          ...Array.from(oldStockMap.keys()),
          ...Array.from(newStockMap.keys()),
        ]);

        for (const key of allKeys) {
          const oldItem = oldStockMap.get(key);
          const newItem = newStockMap.get(key);

          const oldQty = Number(oldItem?.quantity || 0);
          const newQty = Number(newItem?.quantity || 0);
          const diffQty = newQty - oldQty;

          if (diffQty === 0) {
            continue;
          }

          const movementItem = newItem || oldItem;

          if (!movementItem) {
            continue;
          }

          const product = await tx.product.findUnique({
            where: {
              id: movementItem.productId,
            },
            select: {
              id: true,
              currentStock: true,
            },
          });

          if (!product) {
            throw new Error("Product tidak ditemukan");
          }

          const stockBefore = product.currentStock;

          if (diffQty > 0) {
            const stockAfter = stockBefore + diffQty;

            await tx.product.update({
              where: {
                id: movementItem.productId,
              },
              data: {
                currentStock: {
                  increment: diffQty,
                },
                purchasePrice: newItem?.unitPrice ?? movementItem.unitPrice,
              },
            });

            await tx.stockMovement.create({
              data: {
                productId: movementItem.productId,
                warehouseId: movementItem.warehouseId,
                rackLocationId: movementItem.rackLocationId,
                type: "IN",
                quantity: diffQty,
                stockBefore,
                stockAfter,
                referenceType: "STOCK_IN",
                referenceId: oldStockIn.id,
                notes: `Koreksi penambahan qty barang masuk ${documentNumber}`,
                createdById: currentUser.id,
              },
            });
          }

          if (diffQty < 0) {
            const qtyToReduce = Math.abs(diffQty);

            if (stockBefore < qtyToReduce) {
              throw new Error(
                `Stock product tidak cukup untuk koreksi qty barang masuk ${oldStockIn.documentNumber}. Stok tersedia ${stockBefore}, butuh dikurangi ${qtyToReduce}.`,
              );
            }

            const stockAfter = stockBefore - qtyToReduce;

            await tx.product.update({
              where: {
                id: movementItem.productId,
              },
              data: {
                currentStock: {
                  decrement: qtyToReduce,
                },
              },
            });

            await tx.stockMovement.create({
              data: {
                productId: movementItem.productId,
                warehouseId: movementItem.warehouseId,
                rackLocationId: movementItem.rackLocationId,
                type: "OUT",
                quantity: qtyToReduce,
                stockBefore,
                stockAfter,
                referenceType: "STOCK_IN",
                referenceId: oldStockIn.id,
                notes: `Koreksi pengurangan qty barang masuk ${documentNumber}`,
                createdById: currentUser.id,
              },
            });
          }
        }
      }

      await tx.stockInItem.deleteMany({
        where: {
          stockInId: oldStockIn.id,
        },
      });

      const updatedStockIn = await tx.stockIn.update({
        where: {
          id: oldStockIn.id,
        },
        data: {
          supplierId,
          documentNumber,
          invoiceNumber,
          stockInDate,
          dueDate,
          totalAmount,
          paidAmount: oldPaidAmount,
          remainingAmount: newRemainingAmount,
          paymentStatus: newPaymentStatus,
          notes,
        },
      });

      for (const item of normalizedItems) {
        await tx.stockInItem.create({
          data: {
            stockInId: updatedStockIn.id,
            productId: item.productId,
            warehouseId: item.warehouseId,
            rackLocationId: item.rackLocationId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          },
        });

        await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            purchasePrice: item.unitPrice,
          },
        });
      }

      const newStockIn = await tx.stockIn.findUnique({
        where: {
          id: updatedStockIn.id,
        },
        include: stockInInclude,
      });

      return {
        oldStockIn,
        newStockIn,
      };
    });

    if (!result.newStockIn) {
      return errorResponse({
        message: "Gagal mengupdate stock in",
        status: 500,
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        module: "stock_ins",
        resourceType: "stock_ins",
        resourceId: result.newStockIn.id,
        oldData: result.oldStockIn,
        newData: result.newStockIn,
      },
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "stock_ins",
      relatedId: result.newStockIn.id,
      title: "Stock In Updated",
      message: `${currentUser.name || "Someone"} updated stock in ${
        result.newStockIn.documentNumber
      }.`,
    });

    return successResponse({
      message: "Stock in updated successfully",
      data: result.newStockIn,
    });
  } catch (error) {
    console.error("PUT /api/stock-ins/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to update stock in",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("stock_ins.delete");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;
    const { id } = await context.params;

    const result = await prisma.$transaction(async (tx) => {
      const oldStockIn = await tx.stockIn.findUnique({
        where: {
          id,
        },
        include: {
          items: true,
          payments: true,
        },
      });

      if (!oldStockIn) {
        throw new Error("Stock in tidak ditemukan");
      }

      if (oldStockIn.status === "CANCELLED") {
        throw new Error("Stock in sudah dibatalkan");
      }

      if (
        toNumber(oldStockIn.paidAmount) > 0 ||
        oldStockIn.payments.length > 0
      ) {
        throw new Error(
          "Stock in sudah memiliki pembayaran. Hapus/batalkan purchase payment terlebih dahulu sebelum membatalkan stock in.",
        );
      }

      for (const item of oldStockIn.items) {
        const product = await tx.product.findUnique({
          where: {
            id: item.productId,
          },
          select: {
            id: true,
            currentStock: true,
          },
        });

        if (!product) {
          throw new Error("Product tidak ditemukan");
        }

        if (product.currentStock < item.quantity) {
          throw new Error(
            "Stock product tidak cukup untuk membatalkan barang masuk",
          );
        }

        const stockBefore = product.currentStock;
        const stockAfter = stockBefore - item.quantity;

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
            referenceType: "STOCK_IN",
            referenceId: oldStockIn.id,
            notes: `Pembatalan barang masuk ${oldStockIn.documentNumber}`,
            createdById: currentUser.id,
          },
        });
      }

      const cancelledStockIn = await tx.stockIn.update({
        where: {
          id,
        },
        data: {
          status: "CANCELLED",
          paidAmount: 0,
          remainingAmount: 0,
          paymentStatus: "UNPAID",
          cancelledAt: new Date(),
        },
        include: stockInInclude,
      });

      return {
        oldStockIn,
        cancelledStockIn,
      };
    });

    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "DELETE",
        module: "stock_ins",
        resourceType: "stock_ins",
        resourceId: result.cancelledStockIn.id,
        oldData: result.oldStockIn,
        newData: result.cancelledStockIn,
      },
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "DELETE",
      module: "stock_ins",
      relatedId: result.cancelledStockIn.id,
      title: "Stock In Cancelled",
      message: `${currentUser.name || "Someone"} cancelled stock in ${
        result.cancelledStockIn.documentNumber
      }.`,
    });

    return successResponse({
      message: "Stock in cancelled successfully",
      data: result.cancelledStockIn,
    });
  } catch (error) {
    console.error("DELETE /api/stock-ins/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to cancel stock in",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
