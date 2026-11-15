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

type AdjustmentItemBody = {
  productId?: string;
  warehouseId?: string | null;
  rackLocationId?: string | null;
  stockAfter?: number | string | null;
  notes?: string | null;
};

type UpdateAdjustmentBody = {
  documentNumber?: string | null;
  adjustmentDate?: string | null;
  reason?: string | null;
  notes?: string | null;
  items?: AdjustmentItemBody[];
};

function nullableId(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function parseDate(value: unknown) {
  if (!value) return new Date();

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal adjustment tidak valid");
  }

  return date;
}

function parseInteger(value: unknown, fieldName: string) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new Error(`${fieldName} harus berupa angka bulat minimal 0`);
  }

  return numberValue;
}

function parseReason(value: unknown) {
  const reason = String(value || "").trim();

  const allowedReasons = [
    "STOCK_OPNAME",
    "DAMAGED",
    "LOST",
    "FOUND",
    "INPUT_ERROR",
    "OTHER",
  ];

  if (!allowedReasons.includes(reason)) {
    throw new Error("Reason stock adjustment tidak valid");
  }

  return reason as
    | "STOCK_OPNAME"
    | "DAMAGED"
    | "LOST"
    | "FOUND"
    | "INPUT_ERROR"
    | "OTHER";
}

function makeItemKey(item: {
  productId: string;
  warehouseId?: string | null;
  rackLocationId?: string | null;
}) {
  return [
    item.productId,
    item.warehouseId || "",
    item.rackLocationId || "",
  ].join("|");
}

function validateNoDuplicateItems(
  items: Array<{
    productId: string;
    warehouseId?: string | null;
    rackLocationId?: string | null;
  }>,
) {
  const keys = new Set<string>();

  for (const item of items) {
    const key = makeItemKey(item);

    if (keys.has(key)) {
      throw new Error(
        "Product yang sama tidak boleh muncul lebih dari satu kali dalam adjustment yang sama",
      );
    }

    keys.add(key);
  }
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("stock_adjustments.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const adjustment = await prisma.stockAdjustment.findUnique({
      where: {
        id,
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
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!adjustment) {
      return errorResponse({
        message: "Stock adjustment tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Stock adjustment retrieved successfully",
      data: adjustment,
    });
  } catch (error) {
    console.error("GET /api/stock-adjustments/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch stock adjustment",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("stock_adjustments.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;
    const body = (await req.json()) as UpdateAdjustmentBody;

    const adjustmentDate = parseDate(body.adjustmentDate);
    const reason = parseReason(body.reason);
    const notes = body.notes?.trim() || null;
    const items = body.items || [];

    if (items.length === 0) {
      return errorResponse({
        message: "Minimal harus ada 1 item adjustment",
        status: 400,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const oldAdjustment = await tx.stockAdjustment.findUnique({
        where: {
          id,
        },
        include: {
          items: true,
        },
      });

      if (!oldAdjustment) {
        throw new Error("Stock adjustment tidak ditemukan");
      }

      if (oldAdjustment.status === "CANCELLED") {
        throw new Error("Stock adjustment sudah dibatalkan, tidak bisa diedit");
      }

      const documentNumber =
        body.documentNumber?.trim().toUpperCase() ||
        oldAdjustment.documentNumber;

      if (!documentNumber) {
        throw new Error("Nomor dokumen wajib diisi");
      }

      const duplicateDocument = await tx.stockAdjustment.findFirst({
        where: {
          documentNumber,
          id: {
            not: id,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicateDocument) {
        throw new Error("Nomor dokumen sudah digunakan");
      }

      const normalizedItems = items.map((item, index) => {
        const productId = item.productId?.trim();
        const warehouseId = nullableId(item.warehouseId);
        const rackLocationId = nullableId(item.rackLocationId);

        if (!productId) {
          throw new Error(`Product item ${index + 1} wajib dipilih`);
        }

        const stockAfter = parseInteger(
          item.stockAfter,
          `Stock after item ${index + 1}`,
        );

        return {
          productId,
          warehouseId,
          rackLocationId,
          stockAfter,
          notes: item.notes?.trim() || null,
        };
      });

      validateNoDuplicateItems(normalizedItems);

      /**
       * Item lama dikunci berdasarkan product + warehouse + rack.
       */
      const oldItemMap = new Map<
        string,
        {
          id: string;
          productId: string;
          warehouseId: string | null;
          rackLocationId: string | null;
          stockBefore: number;
          stockAfter: number;
          notes: string | null;
        }
      >();

      for (const oldItem of oldAdjustment.items) {
        oldItemMap.set(makeItemKey(oldItem), {
          id: oldItem.id,
          productId: oldItem.productId,
          warehouseId: oldItem.warehouseId,
          rackLocationId: oldItem.rackLocationId,
          stockBefore: oldItem.stockBefore,
          stockAfter: oldItem.stockAfter,
          notes: oldItem.notes,
        });
      }

      const newItemMap = new Map<
        string,
        {
          productId: string;
          warehouseId: string | null;
          rackLocationId: string | null;
          stockAfter: number;
          notes: string | null;
        }
      >();

      for (const item of normalizedItems) {
        newItemMap.set(makeItemKey(item), item);
      }

      const allKeys = new Set<string>([
        ...Array.from(oldItemMap.keys()),
        ...Array.from(newItemMap.keys()),
      ]);

      /**
       * Kita simpan final items baru di sini.
       * Setelah efek stok dihitung, items lama akan dihapus dan diganti.
       */
      const finalItemsToCreate: Array<{
        productId: string;
        warehouseId: string | null;
        rackLocationId: string | null;
        stockBefore: number;
        stockAfter: number;
        difference: number;
        notes: string | null;
      }> = [];

      for (const key of allKeys) {
        const oldItem = oldItemMap.get(key);
        const newItem = newItemMap.get(key);

        const productId = newItem?.productId || oldItem?.productId;
        const warehouseId =
          newItem?.warehouseId ?? oldItem?.warehouseId ?? null;
        const rackLocationId =
          newItem?.rackLocationId ?? oldItem?.rackLocationId ?? null;

        if (!productId) {
          throw new Error("Product tidak valid");
        }

        const product = await tx.product.findUnique({
          where: {
            id: productId,
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

        /**
         * CASE 1:
         * Item lama masih ada di adjustment baru.
         *
         * stockBefore tetap pakai stockBefore lama.
         * Efek baru dihitung dari stockAfter baru.
         *
         * Delta stok cukup:
         * stockAfterBaru - stockAfterLama
         */
        if (oldItem && newItem) {
          const deltaStock = newItem.stockAfter - oldItem.stockAfter;

          if (product.currentStock + deltaStock < 0) {
            throw new Error(
              `Stock product "${product.name}" tidak boleh minus setelah edit adjustment`,
            );
          }

          if (deltaStock !== 0) {
            const stockBeforeMovement = product.currentStock;
            const stockAfterMovement = stockBeforeMovement + deltaStock;

            await tx.product.update({
              where: {
                id: productId,
              },
              data: {
                currentStock: stockAfterMovement,
              },
            });

            await tx.stockMovement.create({
              data: {
                productId,
                warehouseId,
                rackLocationId,
                type: "ADJUSTMENT",
                quantity: Math.abs(deltaStock),
                stockBefore: stockBeforeMovement,
                stockAfter: stockAfterMovement,
                referenceType: "ADJUSTMENT",
                referenceId: id,
                notes: `Edit adjustment ${documentNumber}`,
                createdById: currentUser.id,
              },
            });
          }

          finalItemsToCreate.push({
            productId,
            warehouseId,
            rackLocationId,
            stockBefore: oldItem.stockBefore,
            stockAfter: newItem.stockAfter,
            difference: newItem.stockAfter - oldItem.stockBefore,
            notes: newItem.notes,
          });

          continue;
        }

        /**
         * CASE 2:
         * Item lama dihapus dari adjustment.
         *
         * Balikkan efek lama:
         * inverse = stockBeforeLama - stockAfterLama
         */
        if (oldItem && !newItem) {
          const inverseDelta = oldItem.stockBefore - oldItem.stockAfter;

          if (product.currentStock + inverseDelta < 0) {
            throw new Error(
              `Stock product "${product.name}" tidak boleh minus setelah item adjustment dihapus`,
            );
          }

          if (inverseDelta !== 0) {
            const stockBeforeMovement = product.currentStock;
            const stockAfterMovement = stockBeforeMovement + inverseDelta;

            await tx.product.update({
              where: {
                id: productId,
              },
              data: {
                currentStock: stockAfterMovement,
              },
            });

            await tx.stockMovement.create({
              data: {
                productId,
                warehouseId,
                rackLocationId,
                type: "ADJUSTMENT",
                quantity: Math.abs(inverseDelta),
                stockBefore: stockBeforeMovement,
                stockAfter: stockAfterMovement,
                referenceType: "ADJUSTMENT",
                referenceId: id,
                notes: `Edit adjustment ${documentNumber} - hapus item`,
                createdById: currentUser.id,
              },
            });
          }

          continue;
        }

        /**
         * CASE 3:
         * Item baru ditambahkan.
         *
         * stockBefore = current stock sekarang.
         * stockAfter = input user.
         * Delta = stockAfter - currentStock.
         */
        if (!oldItem && newItem) {
          const stockBeforeAdjustment = product.currentStock;
          const deltaStock = newItem.stockAfter - stockBeforeAdjustment;

          if (newItem.stockAfter < 0) {
            throw new Error(
              `Stock product "${product.name}" tidak boleh minus`,
            );
          }

          if (deltaStock !== 0) {
            const stockBeforeMovement = product.currentStock;
            const stockAfterMovement = newItem.stockAfter;

            await tx.product.update({
              where: {
                id: productId,
              },
              data: {
                currentStock: stockAfterMovement,
              },
            });

            await tx.stockMovement.create({
              data: {
                productId,
                warehouseId,
                rackLocationId,
                type: "ADJUSTMENT",
                quantity: Math.abs(deltaStock),
                stockBefore: stockBeforeMovement,
                stockAfter: stockAfterMovement,
                referenceType: "ADJUSTMENT",
                referenceId: id,
                notes: `Edit adjustment ${documentNumber} - tambah item`,
                createdById: currentUser.id,
              },
            });
          }

          finalItemsToCreate.push({
            productId,
            warehouseId,
            rackLocationId,
            stockBefore: stockBeforeAdjustment,
            stockAfter: newItem.stockAfter,
            difference: newItem.stockAfter - stockBeforeAdjustment,
            notes: newItem.notes,
          });
        }
      }

      await tx.stockAdjustmentItem.deleteMany({
        where: {
          stockAdjustmentId: id,
        },
      });

      for (const item of finalItemsToCreate) {
        await tx.stockAdjustmentItem.create({
          data: {
            stockAdjustmentId: id,
            productId: item.productId,
            warehouseId: item.warehouseId,
            rackLocationId: item.rackLocationId,
            stockBefore: item.stockBefore,
            stockAfter: item.stockAfter,
            difference: item.difference,
            notes: item.notes,
          },
        });
      }

      await tx.stockAdjustment.update({
        where: {
          id,
        },
        data: {
          documentNumber,
          adjustmentDate,
          reason,
          notes,
        },
      });

      const updatedAdjustment = await tx.stockAdjustment.findUnique({
        where: {
          id,
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
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      return {
        oldAdjustment,
        updatedAdjustment,
      };
    });

    if (!result.updatedAdjustment) {
      return errorResponse({
        message: "Gagal update stock adjustment",
        status: 500,
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        module: "stock_adjustments",
        resourceType: "stock_adjustments",
        resourceId: result.updatedAdjustment.id,
        oldData: result.oldAdjustment,
        newData: result.updatedAdjustment,
      },
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "stock_adjustments",
      relatedId: result.updatedAdjustment.id,
      title: "Stock Adjustment Updated",
      message: `${currentUser.name || "Someone"} updated stock adjustment ${
        result.updatedAdjustment.documentNumber
      }.`,
    });

    return successResponse({
      message: "Stock adjustment updated successfully",
      data: result.updatedAdjustment,
    });
  } catch (error) {
    console.error("PATCH /api/stock-adjustments/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to update stock adjustment",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("stock_adjustments.delete");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;

    const result = await prisma.$transaction(async (tx) => {
      const oldAdjustment = await tx.stockAdjustment.findUnique({
        where: {
          id,
        },
        include: {
          items: true,
        },
      });

      if (!oldAdjustment) {
        throw new Error("Stock adjustment tidak ditemukan");
      }

      if (oldAdjustment.status === "CANCELLED") {
        throw new Error("Stock adjustment sudah dibatalkan");
      }

      for (const item of oldAdjustment.items) {
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

        /**
         * Cancel adjustment harus membalik efek adjustment,
         * bukan asal set currentStock = stockBefore.
         *
         * Kenapa?
         * Karena bisa saja setelah adjustment ada transaksi lain.
         *
         * Efek lama = stockAfter - stockBefore
         * Balikan efek = stockBefore - stockAfter
         */
        const inverseDelta = item.stockBefore - item.stockAfter;

        if (product.currentStock + inverseDelta < 0) {
          throw new Error(
            `Stock product "${product.name}" tidak boleh minus setelah pembatalan adjustment`,
          );
        }

        if (inverseDelta !== 0) {
          const stockBeforeMovement = product.currentStock;
          const stockAfterMovement = stockBeforeMovement + inverseDelta;

          await tx.product.update({
            where: {
              id: item.productId,
            },
            data: {
              currentStock: stockAfterMovement,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              warehouseId: item.warehouseId,
              rackLocationId: item.rackLocationId,
              type: "ADJUSTMENT",
              quantity: Math.abs(inverseDelta),
              stockBefore: stockBeforeMovement,
              stockAfter: stockAfterMovement,
              referenceType: "ADJUSTMENT",
              referenceId: oldAdjustment.id,
              notes: `Pembatalan adjustment ${oldAdjustment.documentNumber}`,
              createdById: currentUser.id,
            },
          });
        }
      }

      const cancelledAdjustment = await tx.stockAdjustment.update({
        where: {
          id,
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
        include: {
          items: true,
        },
      });

      return {
        oldAdjustment,
        cancelledAdjustment,
      };
    });

    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "DELETE",
        module: "stock_adjustments",
        resourceType: "stock_adjustments",
        resourceId: result.cancelledAdjustment.id,
        oldData: result.oldAdjustment,
        newData: result.cancelledAdjustment,
      },
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "DELETE",
      module: "stock_adjustments",
      relatedId: result.cancelledAdjustment.id,
      title: "Stock Adjustment Cancelled",
      message: `${currentUser.name || "Someone"} cancelled stock adjustment ${
        result.cancelledAdjustment.documentNumber
      }.`,
    });

    return successResponse({
      message: "Stock adjustment cancelled successfully",
      data: result.cancelledAdjustment,
    });
  } catch (error) {
    console.error("DELETE /api/stock-adjustments/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to cancel stock adjustment",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
