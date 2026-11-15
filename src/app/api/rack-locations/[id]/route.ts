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

type UpdateRackLocationBody = {
  warehouseId?: string;
  name?: string;
  code?: string;
  description?: string | null;
  isActive?: boolean;
};

function generateRackCode(value: string) {
  return value
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateRackBarcodeValue(warehouseCode: string, rackCode: string) {
  return `RACK:${warehouseCode}:${rackCode}`;
}

const rackLocationInclude = {
  warehouse: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("rack_locations.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const rackLocation = await prisma.rackLocation.findUnique({
      where: {
        id,
      },
      include: rackLocationInclude,
    });

    if (!rackLocation) {
      return errorResponse({
        message: "Rack location tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Rack location retrieved successfully",
      data: rackLocation,
    });
  } catch (error) {
    console.error("GET /api/rack-locations/[id] error:", error);

    return errorResponse({
      message: "Failed to fetch rack location",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("rack_locations.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;
    const body = (await req.json()) as UpdateRackLocationBody;

    const oldRackLocation = await prisma.rackLocation.findUnique({
      where: {
        id,
      },
      include: rackLocationInclude,
    });

    if (!oldRackLocation) {
      return errorResponse({
        message: "Rack location tidak ditemukan",
        status: 404,
      });
    }

    const warehouseId = body.warehouseId?.trim();
    const name = body.name?.trim();
    const code = generateRackCode(body.code || body.name || "");
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? oldRackLocation.isActive;

    if (!warehouseId || !name || !code) {
      return errorResponse({
        message: "Warehouse, name, and code are required",
        status: 400,
      });
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: {
        id: warehouseId,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    if (!warehouse) {
      return errorResponse({
        message: "Warehouse tidak ditemukan",
        status: 404,
      });
    }

    const duplicateRackLocation = await prisma.rackLocation.findFirst({
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

    if (duplicateRackLocation) {
      return errorResponse({
        message: "Rack location code sudah digunakan",
        status: 409,
      });
    }

    const barcodeValue = generateRackBarcodeValue(warehouse.code, code);

    const duplicateBarcode = await prisma.rackLocation.findFirst({
      where: {
        id: {
          not: id,
        },
        barcodeValue,
      },
      select: {
        id: true,
      },
    });

    if (duplicateBarcode) {
      return errorResponse({
        message: "Barcode rack location sudah digunakan",
        status: 409,
      });
    }

    const updatedRackLocation = await prisma.$transaction(async (tx) => {
      const rackLocation = await tx.rackLocation.update({
        where: {
          id,
        },
        data: {
          warehouseId,
          name,
          code,
          barcodeValue,
          description,
          isActive,
        },
        include: rackLocationInclude,
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "UPDATE",
          module: "rack_locations",
          resourceType: "rack_locations",
          resourceId: rackLocation.id,
          oldData: oldRackLocation,
          newData: rackLocation,
        },
      });

      return rackLocation;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "rack_locations",
      relatedId: updatedRackLocation.id,
      title: "Rack Location Updated",
      message: `${currentUser.name || "Someone"} updated rack location ${
        updatedRackLocation.name
      }.`,
    });

    return successResponse({
      message: "Rack location updated successfully",
      data: updatedRackLocation,
    });
  } catch (error) {
    console.error("PATCH /api/rack-locations/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to update rack location",
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
      isPermanent ? "rack_locations.delete_permanent" : "rack_locations.delete",
    );

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;

    const oldRackLocation = await prisma.rackLocation.findUnique({
      where: {
        id,
      },
      include: rackLocationInclude,
    });

    if (!oldRackLocation) {
      return errorResponse({
        message: "Rack location tidak ditemukan",
        status: 404,
      });
    }

    if (isPermanent) {
      const deletedRackLocation = await prisma.$transaction(async (tx) => {
        const rackLocation = await tx.rackLocation.delete({
          where: {
            id,
          },
          include: rackLocationInclude,
        });

        await tx.activityLog.create({
          data: {
            userId: currentUser.id,
            action: "DELETE_PERMANENT",
            module: "rack_locations",
            resourceType: "rack_locations",
            resourceId: rackLocation.id,
            oldData: oldRackLocation,
            newData: Prisma.JsonNull,
          },
        });

        return rackLocation;
      });

      await notifyAdmins({
        actorUserId: currentUser.id,
        eventType: "DELETE",
        module: "rack_locations",
        relatedId: deletedRackLocation.id,
        title: "Rack Location Permanently Deleted",
        message: `${
          currentUser.name || "Someone"
        } permanently deleted rack location ${deletedRackLocation.name}.`,
      });

      return successResponse({
        message: "Rack location permanently deleted successfully",
        data: deletedRackLocation,
      });
    }

    if (!oldRackLocation.isActive) {
      return errorResponse({
        message: "Rack location sudah inactive",
        status: 400,
      });
    }

    const disabledRackLocation = await prisma.$transaction(async (tx) => {
      const rackLocation = await tx.rackLocation.update({
        where: {
          id,
        },
        data: {
          isActive: false,
        },
        include: rackLocationInclude,
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "INACTIVE",
          module: "rack_locations",
          resourceType: "rack_locations",
          resourceId: rackLocation.id,
          oldData: oldRackLocation,
          newData: rackLocation,
        },
      });

      return rackLocation;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "rack_locations",
      relatedId: disabledRackLocation.id,
      title: "Rack Location Inactivated",
      message: `${currentUser.name || "Someone"} inactivated rack location ${
        disabledRackLocation.name
      }.`,
    });

    return successResponse({
      message: "Rack location inactivated successfully",
      data: disabledRackLocation,
    });
  } catch (error) {
    console.error("DELETE /api/rack-locations/[id] error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return errorResponse({
        message:
          "Rack location tidak bisa dihapus permanent karena masih digunakan oleh data lain. Gunakan inactive saja.",
        status: 409,
        errors: error.message,
      });
    }

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete rack location",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
