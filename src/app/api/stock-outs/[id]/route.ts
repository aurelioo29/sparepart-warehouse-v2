import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("stock_outs.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const stockOut = await prisma.stockOut.findUnique({
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
        },
      },
    });

    if (!stockOut) {
      return errorResponse({
        message: "Stock out tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Stock out retrieved successfully",
      data: stockOut,
    });
  } catch (error) {
    console.error("GET /api/stock-outs/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to fetch stock out",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("stock_outs.delete");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;

    const result = await prisma.$transaction(async (tx) => {
      const oldStockOut = await tx.stockOut.findUnique({
        where: {
          id,
        },
        include: {
          items: true,
        },
      });

      if (!oldStockOut) {
        throw new Error("Stock out tidak ditemukan");
      }

      if (oldStockOut.status === "CANCELLED") {
        throw new Error("Stock out sudah dibatalkan");
      }

      for (const item of oldStockOut.items) {
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
            referenceType: "STOCK_OUT",
            referenceId: oldStockOut.id,
            notes: `Pembatalan barang keluar ${oldStockOut.documentNumber}`,
            createdById: currentUser.id,
          },
        });
      }

      const cancelledStockOut = await tx.stockOut.update({
        where: {
          id,
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
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
              product: true,
            },
          },
        },
      });

      return {
        oldStockOut,
        cancelledStockOut,
      };
    });

    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "DELETE",
        module: "stock_outs",
        resourceType: "stock_outs",
        resourceId: result.cancelledStockOut.id,
        oldData: result.oldStockOut,
        newData: result.cancelledStockOut,
      },
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "DELETE",
      module: "stock_outs",
      relatedId: result.cancelledStockOut.id,
      title: "Stock Out Cancelled",
      message: `${currentUser.name || "Someone"} cancelled stock out ${
        result.cancelledStockOut.documentNumber
      }.`,
    });

    return successResponse({
      message: "Stock out cancelled successfully",
      data: result.cancelledStockOut,
    });
  } catch (error) {
    console.error("DELETE /api/stock-outs/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to cancel stock out",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
