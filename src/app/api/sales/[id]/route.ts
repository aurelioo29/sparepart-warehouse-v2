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

type SaleItemBody = {
  productId?: string;
  warehouseId?: string | null;
  rackLocationId?: string | null;
  quantity?: number | string;
  unitPrice?: number | string | null;
  discountPercent?: number | string | null;
  additionalDiscountPercent?: number | string | null;
  additionalDiscountPercent2?: number | string | null;
};

type UpdateSaleBody = {
  customerId?: string | null;
  salesmanId?: string | null;
  invoiceNumber?: string | null;
  saleDate?: string | null;
  dueDate?: string | null;
  paidAmount?: number | string | null;
  notes?: string | null;
  items?: SaleItemBody[];
};

function nullableId(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function parseDate(value: unknown) {
  if (!value) return new Date();

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal penjualan tidak valid");
  }

  return date;
}

function parseNullableDate(value: unknown) {
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
  if (value === null || value === undefined || value === "") return fallback;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue) || numberValue < 0) {
    throw new Error("Nominal harus berupa angka minimal 0");
  }

  return numberValue;
}

function parsePercent(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue) || numberValue < 0 || numberValue > 100) {
    throw new Error("Diskon persen harus berupa angka 0 sampai 100");
  }

  return numberValue;
}

function calculateSaleItemTotal({
  quantity,
  unitPrice,
  discountPercent,
  additionalDiscountPercent,
  additionalDiscountPercent2,
}: {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  additionalDiscountPercent: number;
  additionalDiscountPercent2: number;
}) {
  const subtotal = quantity * unitPrice;
  const mainDiscountAmount = subtotal * (discountPercent / 100);

  const afterMainDiscount = subtotal - mainDiscountAmount;

  const additionalDiscountAmount =
    afterMainDiscount * (additionalDiscountPercent / 100);

  const afterAdditionalDiscount = afterMainDiscount - additionalDiscountAmount;

  const additionalDiscountAmount2 =
    afterAdditionalDiscount * (additionalDiscountPercent2 / 100);

  const discountAmount =
    mainDiscountAmount + additionalDiscountAmount + additionalDiscountAmount2;

  const totalPrice = Math.max(subtotal - discountAmount, 0);

  return {
    subtotal,
    discountAmount,
    totalPrice,
  };
}

function getPaymentStatus(totalAmount: number, paidAmount: number) {
  if (paidAmount <= 0) return "UNPAID";
  if (paidAmount >= totalAmount) return "PAID";
  return "PARTIAL";
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("sales.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const sale = await prisma.sale.findUnique({
      where: {
        id,
      },
      include: {
        customer: true,
        salesman: true,
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
                unit: {
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                  },
                },
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
          orderBy: {
            paymentDate: "asc",
          },
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
      },
    });

    if (!sale) {
      return errorResponse({
        message: "Sale tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Sale retrieved successfully",
      data: sale,
    });
  } catch (error) {
    console.error("GET /api/sales/[id] error:", error);

    return errorResponse({
      message: error instanceof Error ? error.message : "Failed to fetch sale",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("sales.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;
    const body = (await req.json()) as UpdateSaleBody;

    const customerId = nullableId(body.customerId);
    const salesmanId = nullableId(body.salesmanId);
    const saleDate = parseDate(body.saleDate);
    const dueDate = parseNullableDate(body.dueDate);
    const notes = body.notes?.trim() || null;
    const paidAmountInput = parseDecimal(body.paidAmount, 0);
    const items = body.items || [];

    if (items.length === 0) {
      return errorResponse({
        message: "Minimal harus ada 1 item penjualan",
        status: 400,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const oldSale = await tx.sale.findUnique({
        where: {
          id,
        },
        include: {
          items: true,
          payments: true,
        },
      });

      if (!oldSale) {
        throw new Error("Sale tidak ditemukan");
      }

      if (oldSale.status === "CANCELLED") {
        throw new Error("Sale sudah dibatalkan, tidak bisa diedit");
      }

      const invoiceNumber =
        body.invoiceNumber?.trim().toUpperCase() ||
        oldSale.invoiceNumber?.trim().toUpperCase() ||
        "";

      if (!invoiceNumber) {
        throw new Error("Nomor invoice wajib diisi saat edit");
      }

      const duplicateInvoice = await tx.sale.findFirst({
        where: {
          invoiceNumber,
          id: {
            not: id,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicateInvoice) {
        throw new Error("Nomor invoice sudah digunakan");
      }

      if (customerId) {
        const customer = await tx.customer.findUnique({
          where: {
            id: customerId,
          },
          select: {
            id: true,
          },
        });

        if (!customer) {
          throw new Error("Customer tidak ditemukan");
        }
      }

      if (salesmanId) {
        const salesman = await tx.salesman.findUnique({
          where: {
            id: salesmanId,
          },
          select: {
            id: true,
          },
        });

        if (!salesman) {
          throw new Error("Salesman tidak ditemukan");
        }
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
        const discountPercent = parsePercent(item.discountPercent, 0);

        const additionalDiscountPercent = parsePercent(
          item.additionalDiscountPercent,
          0,
        );
        const additionalDiscountPercent2 = parsePercent(
          item.additionalDiscountPercent2,
          0,
        );

        if (!productId) {
          throw new Error(`Product item ${index + 1} wajib dipilih`);
        }

        const { discountAmount, totalPrice } = calculateSaleItemTotal({
          quantity,
          unitPrice,
          discountPercent,
          additionalDiscountPercent,
          additionalDiscountPercent2,
        });

        if (totalPrice < 0) {
          throw new Error(`Total item ${index + 1} tidak boleh minus`);
        }

        return {
          productId,
          warehouseId,
          rackLocationId,
          quantity,
          unitPrice,
          discountPercent,
          discountQty: quantity,
          additionalDiscountPercent,
          additionalDiscountPercent2,
          discountAmount,
          totalPrice,
        };
      });

      /**
       * Gabungkan baris penjualan yang benar-benar identik.
       * Produk yang sama tetapi lokasi, harga, atau diskonnya berbeda
       * tetap disimpan sebagai baris terpisah.
       */
      const mergedItemMap = new Map<string, (typeof normalizedItems)[number]>();

      for (const item of normalizedItems) {
        const key = JSON.stringify([
          item.productId,
          item.warehouseId,
          item.rackLocationId,
          item.unitPrice,
          item.discountPercent,
          item.additionalDiscountPercent,
          item.additionalDiscountPercent2,
        ]);

        const existing = mergedItemMap.get(key);

        if (!existing) {
          mergedItemMap.set(key, { ...item });
          continue;
        }

        existing.quantity += item.quantity;
        existing.discountQty = existing.quantity;

        const recalculated = calculateSaleItemTotal({
          quantity: existing.quantity,
          unitPrice: existing.unitPrice,
          discountPercent: existing.discountPercent,
          additionalDiscountPercent: existing.additionalDiscountPercent,
          additionalDiscountPercent2: existing.additionalDiscountPercent2,
        });

        existing.discountAmount = recalculated.discountAmount;
        existing.totalPrice = recalculated.totalPrice;
      }

      const mergedItems = Array.from(mergedItemMap.values());

      const subtotal = mergedItems.reduce(
        (total, item) => total + item.quantity * item.unitPrice,
        0,
      );

      const totalDiscountAmount = mergedItems.reduce(
        (total, item) => total + item.discountAmount,
        0,
      );

      const totalAmount = mergedItems.reduce(
        (total, item) => total + item.totalPrice,
        0,
      );

      if (totalAmount < 0) {
        throw new Error("Total penjualan tidak boleh minus");
      }

      if (paidAmountInput > totalAmount) {
        throw new Error(
          "Nominal pembayaran tidak boleh lebih besar dari total",
        );
      }

      const remainingAmount = totalAmount - paidAmountInput;
      const paymentStatus = getPaymentStatus(totalAmount, paidAmountInput);

      /**
       * Kunci item lama berdasarkan product + warehouse + rack.
       * Ini supaya sistem tahu qty lama untuk kombinasi lokasi yang sama.
       */
      const oldItemMap = new Map<
        string,
        {
          productId: string;
          warehouseId: string | null;
          rackLocationId: string | null;
          quantity: number;
        }
      >();

      for (const oldItem of oldSale.items) {
        const key = [
          oldItem.productId,
          oldItem.warehouseId || "",
          oldItem.rackLocationId || "",
        ].join("|");

        const existing = oldItemMap.get(key);

        if (existing) {
          existing.quantity += oldItem.quantity;
        } else {
          oldItemMap.set(key, {
            productId: oldItem.productId,
            warehouseId: oldItem.warehouseId,
            rackLocationId: oldItem.rackLocationId,
            quantity: oldItem.quantity,
          });
        }
      }

      /**
       * Kunci item baru berdasarkan product + warehouse + rack.
       */
      const newItemMap = new Map<
        string,
        {
          productId: string;
          warehouseId: string | null;
          rackLocationId: string | null;
          quantity: number;
        }
      >();

      for (const item of mergedItems) {
        const key = [
          item.productId,
          item.warehouseId || "",
          item.rackLocationId || "",
        ].join("|");

        const existing = newItemMap.get(key);

        if (existing) {
          existing.quantity += item.quantity;
        } else {
          newItemMap.set(key, {
            productId: item.productId,
            warehouseId: item.warehouseId,
            rackLocationId: item.rackLocationId,
            quantity: item.quantity,
          });
        }
      }

      /**
       * Ambil semua key lama + baru.
       * Lalu hitung delta qty.
       */
      const allKeys = new Set<string>([
        ...Array.from(oldItemMap.keys()),
        ...Array.from(newItemMap.keys()),
      ]);

      for (const key of allKeys) {
        const oldItem = oldItemMap.get(key);
        const newItem = newItemMap.get(key);

        const productId = newItem?.productId || oldItem?.productId;
        const warehouseId =
          newItem?.warehouseId ?? oldItem?.warehouseId ?? null;
        const rackLocationId =
          newItem?.rackLocationId ?? oldItem?.rackLocationId ?? null;

        const oldQty = oldItem?.quantity || 0;
        const newQty = newItem?.quantity || 0;

        const deltaQty = newQty - oldQty;

        /**
         * Kalau cuma edit harga, deltaQty = 0.
         * Jadi stok tidak disentuh. Ini inti fix-nya.
         */
        if (deltaQty === 0) {
          continue;
        }

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
         * Jika delta positif: qty bertambah, stok harus dikurangi.
         */
        if (deltaQty > 0) {
          if (product.currentStock < deltaQty) {
            throw new Error(
              `Stock product "${product.name}" tidak cukup. Tersedia: ${product.currentStock}`,
            );
          }

          const stockBefore = product.currentStock;
          const stockAfter = stockBefore - deltaQty;

          await tx.product.update({
            where: {
              id: productId,
            },
            data: {
              currentStock: {
                decrement: deltaQty,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId,
              warehouseId,
              rackLocationId,
              type: "OUT",
              quantity: deltaQty,
              stockBefore,
              stockAfter,
              referenceType: "SALE",
              referenceId: id,
              notes: `Edit penjualan ${invoiceNumber} - tambah qty`,
              createdById: currentUser.id,
            },
          });
        }

        /**
         * Jika delta negatif: qty berkurang, stok harus dikembalikan.
         */
        if (deltaQty < 0) {
          const restoreQty = Math.abs(deltaQty);

          const stockBefore = product.currentStock;
          const stockAfter = stockBefore + restoreQty;

          await tx.product.update({
            where: {
              id: productId,
            },
            data: {
              currentStock: {
                increment: restoreQty,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId,
              warehouseId,
              rackLocationId,
              type: "IN",
              quantity: restoreQty,
              stockBefore,
              stockAfter,
              referenceType: "SALE",
              referenceId: id,
              notes: `Edit penjualan ${invoiceNumber} - kurangi qty`,
              createdById: currentUser.id,
            },
          });
        }
      }

      /**
       * Setelah stok selesai dihitung berdasarkan delta,
       * baru replace sale items untuk simpan harga/diskon terbaru.
       */
      await tx.saleItem.deleteMany({
        where: {
          saleId: id,
        },
      });

      for (const item of mergedItems) {
        await tx.saleItem.create({
          data: {
            saleId: id,
            productId: item.productId,
            warehouseId: item.warehouseId,
            rackLocationId: item.rackLocationId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            discountQty: item.discountQty,
            additionalDiscountPercent: item.additionalDiscountPercent,
            additionalDiscountPercent2: item.additionalDiscountPercent2,
            discountAmount: item.discountAmount,
            totalPrice: item.totalPrice,
          },
        });
      }

      await tx.sale.update({
        where: {
          id,
        },
        data: {
          customerId,
          salesmanId,
          invoiceNumber,
          saleDate,
          status: "POSTED",
          paymentStatus,
          subtotal,
          discountAmount: totalDiscountAmount,
          totalAmount,
          paidAmount: paidAmountInput,
          remainingAmount,
          dueDate,
          notes,
        },
      });

      const updatedSale = await tx.sale.findUnique({
        where: {
          id,
        },
        include: {
          customer: true,
          salesman: true,
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
          payments: true,
        },
      });

      return {
        oldSale,
        updatedSale,
      };
    });

    if (!result.updatedSale) {
      return errorResponse({
        message: "Gagal update sale",
        status: 500,
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        module: "sales",
        resourceType: "sales",
        resourceId: result.updatedSale.id,
        oldData: result.oldSale,
        newData: result.updatedSale,
      },
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "sales",
      relatedId: result.updatedSale.id,
      title: "Sale Updated",
      message: `${currentUser.name || "Someone"} updated sale ${
        result.updatedSale.invoiceNumber
      }.`,
    });

    return successResponse({
      message: "Sale updated successfully",
      data: result.updatedSale,
    });
  } catch (error) {
    console.error("PATCH /api/sales/[id] error:", error);

    return errorResponse({
      message: error instanceof Error ? error.message : "Failed to update sale",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("sales.delete");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;

    const result = await prisma.$transaction(async (tx) => {
      const oldSale = await tx.sale.findUnique({
        where: {
          id,
        },
        include: {
          items: true,
          payments: true,
        },
      });

      if (!oldSale) {
        throw new Error("Sale tidak ditemukan");
      }

      if (oldSale.status === "CANCELLED") {
        throw new Error("Sale sudah dibatalkan");
      }

      for (const item of oldSale.items) {
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

        const stockBefore = product.currentStock;
        const stockAfter = stockBefore + item.quantity;

        await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            currentStock: {
              increment: item.quantity,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: item.warehouseId,
            rackLocationId: item.rackLocationId,
            type: "IN",
            quantity: item.quantity,
            stockBefore,
            stockAfter,
            referenceType: "SALE",
            referenceId: oldSale.id,
            notes: `Pembatalan penjualan ${oldSale.invoiceNumber}`,
            createdById: currentUser.id,
          },
        });
      }

      const cancelledSale = await tx.sale.update({
        where: {
          id,
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
        include: {
          customer: true,
          salesman: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
          payments: true,
        },
      });

      return {
        oldSale,
        cancelledSale,
      };
    });

    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "DELETE",
        module: "sales",
        resourceType: "sales",
        resourceId: result.cancelledSale.id,
        oldData: result.oldSale,
        newData: result.cancelledSale,
      },
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "DELETE",
      module: "sales",
      relatedId: result.cancelledSale.id,
      title: "Sale Cancelled",
      message: `${currentUser.name || "Someone"} cancelled sale ${
        result.cancelledSale.invoiceNumber
      }.`,
    });

    return successResponse({
      message: "Sale cancelled successfully",
      data: result.cancelledSale,
    });
  } catch (error) {
    console.error("DELETE /api/sales/[id] error:", error);

    return errorResponse({
      message: error instanceof Error ? error.message : "Failed to cancel sale",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
