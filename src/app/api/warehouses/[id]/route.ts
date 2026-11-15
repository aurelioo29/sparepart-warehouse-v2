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

type UpdateWarehouseBody = {
  name?: string;
  code?: string;
  address?: string | null;
  description?: string | null;
  isActive?: boolean;
};

const warehouseInclude = {
  _count: {
    select: {
      rackLocations: true,
    },
  },
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("warehouses.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const warehouse = await prisma.warehouse.findUnique({
      where: {
        id,
      },
      include: warehouseInclude,
    });

    if (!warehouse) {
      return errorResponse({
        message: "Warehouse tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Warehouse retrieved successfully",
      data: warehouse,
    });
  } catch (error) {
    console.error("GET /api/warehouses/[id] error:", error);

    return errorResponse({
      message: "Failed to fetch warehouse",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("warehouses.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;
    const body = (await req.json()) as UpdateWarehouseBody;

    const oldWarehouse = await prisma.warehouse.findUnique({
      where: {
        id,
      },
      include: warehouseInclude,
    });

    if (!oldWarehouse) {
      return errorResponse({
        message: "Warehouse tidak ditemukan",
        status: 404,
      });
    }

    const name = body.name?.trim();
    const code = body.code?.trim().toUpperCase();
    const address = body.address?.trim() || null;
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? oldWarehouse.isActive;

    if (!name || !code) {
      return errorResponse({
        message: "Name and code are required",
        status: 400,
      });
    }

    const duplicateWarehouse = await prisma.warehouse.findFirst({
      where: {
        id: {
          not: id,
        },
        code,
      },
      select: {
        id: true,
      },
    });

    if (duplicateWarehouse) {
      return errorResponse({
        message: "Warehouse code sudah digunakan",
        status: 409,
      });
    }

    const updatedWarehouse = await prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.update({
        where: {
          id,
        },
        data: {
          name,
          code,
          address,
          description,
          isActive,
        },
        include: warehouseInclude,
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "UPDATE",
          module: "warehouses",
          resourceType: "warehouses",
          resourceId: warehouse.id,
          oldData: oldWarehouse,
          newData: warehouse,
        },
      });

      return warehouse;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "warehouses",
      relatedId: updatedWarehouse.id,
      title: "Warehouse Updated",
      message: `${currentUser.name || "Someone"} updated warehouse ${
        updatedWarehouse.name
      }.`,
    });

    return successResponse({
      message: "Warehouse updated successfully",
      data: updatedWarehouse,
    });
  } catch (error) {
    console.error("PATCH /api/warehouses/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to update warehouse",
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
      isPermanent ? "warehouses.delete_permanent" : "warehouses.delete",
    );

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;

    const oldWarehouse = await prisma.warehouse.findUnique({
      where: {
        id,
      },
      include: warehouseInclude,
    });

    if (!oldWarehouse) {
      return errorResponse({
        message: "Warehouse tidak ditemukan",
        status: 404,
      });
    }

    if (isPermanent) {
      const deletedWarehouse = await prisma.$transaction(async (tx) => {
        const warehouse = await tx.warehouse.delete({
          where: {
            id,
          },
        });

        await tx.activityLog.create({
          data: {
            userId: currentUser.id,
            action: "DELETE_PERMANENT",
            module: "warehouses",
            resourceType: "warehouses",
            resourceId: warehouse.id,
            oldData: oldWarehouse,
            newData: Prisma.JsonNull,
          },
        });

        return warehouse;
      });

      await notifyAdmins({
        actorUserId: currentUser.id,
        eventType: "DELETE",
        module: "warehouses",
        relatedId: deletedWarehouse.id,
        title: "Warehouse Permanently Deleted",
        message: `${currentUser.name || "Someone"} permanently deleted warehouse ${
          deletedWarehouse.name
        }.`,
      });

      return successResponse({
        message: "Warehouse permanently deleted successfully",
        data: deletedWarehouse,
      });
    }

    if (!oldWarehouse.isActive) {
      return errorResponse({
        message: "Warehouse sudah inactive",
        status: 400,
      });
    }

    const disabledWarehouse = await prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.update({
        where: {
          id,
        },
        data: {
          isActive: false,
        },
        include: warehouseInclude,
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "INACTIVE",
          module: "warehouses",
          resourceType: "warehouses",
          resourceId: warehouse.id,
          oldData: oldWarehouse,
          newData: warehouse,
        },
      });

      return warehouse;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "warehouses",
      relatedId: disabledWarehouse.id,
      title: "Warehouse Inactivated",
      message: `${currentUser.name || "Someone"} inactivated warehouse ${
        disabledWarehouse.name
      }.`,
    });

    return successResponse({
      message: "Warehouse inactivated successfully",
      data: disabledWarehouse,
    });
  } catch (error) {
    console.error("DELETE /api/warehouses/[id] error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return errorResponse({
        message:
          "Warehouse tidak bisa dihapus permanent karena masih digunakan oleh rack location / stock / transaksi lain. Gunakan inactive saja.",
        status: 409,
        errors: error.message,
      });
    }

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to delete warehouse",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
