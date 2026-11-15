import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";
import {
  calculateHargaNetto,
  parseKngOrderDate,
  toJson,
} from "@/lib/kng-orders";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateKngOrderBody = {
  orderDate?: string;
  discountPercent?: number | string;
  noteFranco?: string | null;
  noteTop?: string | null;
  notes?: string | null;
  items?: {
    kngProductId?: string;
    quantity?: number | string;
    hargaNetto?: number | string;
  }[];
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("kng-orders.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const order = await prisma.kngOrder.findUnique({
      where: {
        id,
      },
      include: {
        items: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            product: {
              select: {
                id: true,
                jenis: true,
                partNumber: true,
                hargaJkt: true,
                isActive: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!order) {
      return errorResponse({
        message: "KNG order tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "KNG order retrieved successfully",
      data: order,
    });
  } catch (error) {
    console.error("GET /api/kng-orders/[id] error:", error);

    return errorResponse({
      message: "Failed to fetch KNG order",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("kng-orders.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const user = auth.user;

    const { id } = await context.params;
    const body = (await req.json()) as UpdateKngOrderBody;

    const oldOrder = await prisma.kngOrder.findUnique({
      where: {
        id,
      },
      include: {
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!oldOrder) {
      return errorResponse({
        message: "KNG order tidak ditemukan",
        status: 404,
      });
    }

    if (oldOrder.status === "CANCELLED") {
      return errorResponse({
        message: "KNG order sudah cancelled dan tidak bisa diedit",
        status: 400,
      });
    }

    const orderDate = body.orderDate
      ? parseKngOrderDate(body.orderDate)
      : oldOrder.orderDate;

    const discountPercent =
      body.discountPercent !== undefined
        ? Number(body.discountPercent)
        : Number(oldOrder.discountPercent);

    const noteFranco =
      body.noteFranco !== undefined
        ? body.noteFranco?.trim() || null
        : oldOrder.noteFranco;

    const noteTop =
      body.noteTop !== undefined
        ? body.noteTop?.trim() || null
        : oldOrder.noteTop;

    const notes =
      body.notes !== undefined ? body.notes?.trim() || null : oldOrder.notes;

    if (
      Number.isNaN(discountPercent) ||
      discountPercent < 0 ||
      discountPercent > 100
    ) {
      return errorResponse({
        message: "Diskon tidak valid",
        status: 400,
      });
    }

    let normalizedItems:
      | {
          kngProductId: string;
          quantity: number;
          hargaNetto: number;
        }[]
      | null = null;

    if (body.items) {
      if (body.items.length === 0) {
        return errorResponse({
          message: "Minimal 1 product wajib ditambahkan",
          status: 400,
        });
      }

      normalizedItems = body.items.map((item) => ({
        kngProductId: item.kngProductId?.trim() || "",
        quantity: Number(item.quantity || 0),
        hargaNetto: Number(item.hargaNetto || 0),
      }));

      const invalidItem = normalizedItems.find((item) => {
        return (
          !item.kngProductId ||
          Number.isNaN(item.quantity) ||
          item.quantity <= 0 ||
          Number.isNaN(item.hargaNetto) ||
          item.hargaNetto < 0
        );
      });

      if (invalidItem) {
        return errorResponse({
          message:
            "Product, order/pc, dan harga netto wajib diisi dengan benar",
          status: 400,
        });
      }
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const orderNumber = oldOrder.orderNumber;

      let totalQty = oldOrder.totalQty;
      let totalAmount = Number(oldOrder.totalAmount);

      if (normalizedItems) {
        const productIds = normalizedItems.map((item) => item.kngProductId);
        const uniqueProductIds = Array.from(new Set(productIds));

        const products = await tx.kngProduct.findMany({
          where: {
            id: {
              in: uniqueProductIds,
            },
            isActive: true,
          },
        });

        if (products.length !== uniqueProductIds.length) {
          throw new Error(
            "Ada product KNG yang tidak ditemukan atau tidak aktif",
          );
        }

        const productMap = new Map(
          products.map((product) => [product.id, product]),
        );

        const orderItems = normalizedItems.map((item) => {
          const product = productMap.get(item.kngProductId);

          if (!product) {
            throw new Error("Product KNG tidak ditemukan");
          }

          const hargaJkt = Number(product.hargaJkt);
          const defaultHargaNetto = calculateHargaNetto(
            hargaJkt,
            discountPercent,
          );

          const hargaNetto =
            item.hargaNetto > 0 ? item.hargaNetto : defaultHargaNetto;

          const itemTotalAmount = hargaNetto * item.quantity;

          return {
            product,
            quantity: item.quantity,
            hargaJkt,
            hargaNetto,
            totalAmount: itemTotalAmount,
          };
        });

        totalQty = orderItems.reduce((sum, item) => {
          return sum + item.quantity;
        }, 0);

        totalAmount = orderItems.reduce((sum, item) => {
          return sum + item.totalAmount;
        }, 0);

        await tx.kngOrderItem.deleteMany({
          where: {
            kngOrderId: id,
          },
        });

        await tx.kngOrderItem.createMany({
          data: orderItems.map((item) => ({
            kngOrderId: id,
            kngProductId: item.product.id,
            jenisSnapshot: item.product.jenis,
            partNumberSnapshot: item.product.partNumber,
            hargaJkt: item.hargaJkt,
            hargaNetto: item.hargaNetto,
            quantity: item.quantity,
            totalAmount: item.totalAmount,
          })),
        });
      }

      const order = await tx.kngOrder.update({
        where: {
          id,
        },
        data: {
          orderNumber,
          orderDate,
          discountPercent,
          totalQty,
          totalAmount,
          noteFranco,
          noteTop,
          notes,
        },
        include: {
          items: {
            orderBy: {
              createdAt: "asc",
            },
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
            },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "UPDATE",
          module: "kng-orders",
          resourceType: "kng-orders",
          resourceId: order.id,
          oldData: toJson(oldOrder),
          newData: toJson(order),
        },
      });

      return order;
    });

    await notifyAdmins({
      actorUserId: user.id,
      eventType: "UPDATE",
      module: "kng-orders",
      relatedId: updatedOrder.id,
      title: "KNG Order Updated",
      message: `${user.name || "Someone"} updated KNG order ${
        updatedOrder.orderNumber
      }.`,
    });

    return successResponse({
      message: "KNG order updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("PATCH /api/kng-orders/[id] error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return errorResponse({
        message: "Nomor order bentrok. Coba submit ulang.",
        status: 409,
        errors: error.message,
      });
    }

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to update KNG order",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { searchParams } = new URL(req.url);
    const isPermanent = searchParams.get("permanent") === "true";

    const auth = await requirePermission(
      isPermanent ? "kng-orders.delete_permanent" : "kng-orders.delete",
    );

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const user = auth.user;

    const { id } = await context.params;

    const oldOrder = await prisma.kngOrder.findUnique({
      where: {
        id,
      },
      include: {
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!oldOrder) {
      return errorResponse({
        message: "KNG order tidak ditemukan",
        status: 404,
      });
    }

    if (isPermanent) {
      const deletedOrder = await prisma.$transaction(async (tx) => {
        const order = await tx.kngOrder.delete({
          where: {
            id,
          },
          include: {
            items: true,
          },
        });

        await tx.activityLog.create({
          data: {
            userId: user.id,
            action: "DELETE_PERMANENT",
            module: "kng-orders",
            resourceType: "kng-orders",
            resourceId: order.id,
            oldData: toJson(oldOrder),
            newData: Prisma.JsonNull,
          },
        });

        return order;
      });

      await notifyAdmins({
        actorUserId: user.id,
        eventType: "DELETE",
        module: "kng-orders",
        relatedId: deletedOrder.id,
        title: "KNG Order Permanently Deleted",
        message: `${user.name || "Someone"} permanently deleted KNG order ${
          deletedOrder.orderNumber
        }.`,
      });

      return successResponse({
        message: "KNG order permanently deleted successfully",
        data: deletedOrder,
      });
    }

    if (oldOrder.status === "CANCELLED") {
      return errorResponse({
        message: "KNG order sudah cancelled",
        status: 400,
      });
    }

    const cancelledOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.kngOrder.update({
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

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "DELETE",
          module: "kng-orders",
          resourceType: "kng-orders",
          resourceId: order.id,
          oldData: toJson(oldOrder),
          newData: toJson(order),
        },
      });

      return order;
    });

    await notifyAdmins({
      actorUserId: user.id,
      eventType: "UPDATE",
      module: "kng-orders",
      relatedId: cancelledOrder.id,
      title: "KNG Order Cancelled",
      message: `${user.name || "Someone"} cancelled KNG order ${
        cancelledOrder.orderNumber
      }.`,
    });

    return successResponse({
      message: "KNG order cancelled successfully",
      data: cancelledOrder,
    });
  } catch (error) {
    console.error("DELETE /api/kng-orders/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to delete KNG order",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
