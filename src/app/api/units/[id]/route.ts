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

type UpdateUnitBody = {
  name?: string;
  shortName?: string;
  description?: string | null;
  isActive?: boolean;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("units.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const unit = await prisma.unit.findUnique({
      where: {
        id,
      },
    });

    if (!unit) {
      return errorResponse({
        message: "Unit tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Unit retrieved successfully",
      data: unit,
    });
  } catch (error) {
    console.error("GET /api/units/[id] error:", error);

    return errorResponse({
      message: "Failed to fetch unit",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("units.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;
    const body = (await req.json()) as UpdateUnitBody;

    const oldUnit = await prisma.unit.findUnique({
      where: {
        id,
      },
    });

    if (!oldUnit) {
      return errorResponse({
        message: "Unit tidak ditemukan",
        status: 404,
      });
    }

    const name = body.name?.trim();
    const shortName = body.shortName?.trim().toLowerCase();
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? oldUnit.isActive;

    if (!name || !shortName) {
      return errorResponse({
        message: "Name and short name are required",
        status: 400,
      });
    }

    const duplicateUnit = await prisma.unit.findFirst({
      where: {
        id: {
          not: id,
        },
        shortName,
      },
      select: {
        id: true,
      },
    });

    if (duplicateUnit) {
      return errorResponse({
        message: "Short name tersebut sudah digunakan",
        status: 409,
      });
    }

    const updatedUnit = await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.update({
        where: {
          id,
        },
        data: {
          name,
          shortName,
          description,
          isActive,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "UPDATE",
          module: "units",
          resourceType: "units",
          resourceId: unit.id,
          oldData: oldUnit,
          newData: unit,
        },
      });

      return unit;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "units",
      relatedId: updatedUnit.id,
      title: "Unit Updated",
      message: `${currentUser.name || "Someone"} updated unit ${
        updatedUnit.name
      }.`,
    });

    return successResponse({
      message: "Unit updated successfully",
      data: updatedUnit,
    });
  } catch (error) {
    console.error("PATCH /api/units/[id] error:", error);

    return errorResponse({
      message: error instanceof Error ? error.message : "Failed to update unit",
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
      isPermanent ? "units.delete_permanent" : "units.delete",
    );

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;

    const oldUnit = await prisma.unit.findUnique({
      where: {
        id,
      },
    });

    if (!oldUnit) {
      return errorResponse({
        message: "Unit tidak ditemukan",
        status: 404,
      });
    }

    if (isPermanent) {
      const deletedUnit = await prisma.$transaction(async (tx) => {
        const unit = await tx.unit.delete({
          where: {
            id,
          },
        });

        await tx.activityLog.create({
          data: {
            userId: currentUser.id,
            action: "DELETE_PERMANENT",
            module: "units",
            resourceType: "units",
            resourceId: unit.id,
            oldData: oldUnit,
            newData: Prisma.JsonNull,
          },
        });

        return unit;
      });

      await notifyAdmins({
        actorUserId: currentUser.id,
        eventType: "DELETE",
        module: "units",
        relatedId: deletedUnit.id,
        title: "Unit Permanently Deleted",
        message: `${currentUser.name || "Someone"} permanently deleted unit ${
          deletedUnit.name
        }.`,
      });

      return successResponse({
        message: "Unit permanently deleted successfully",
        data: deletedUnit,
      });
    }

    if (!oldUnit.isActive) {
      return errorResponse({
        message: "Unit sudah inactive",
        status: 400,
      });
    }

    const disabledUnit = await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.update({
        where: {
          id,
        },
        data: {
          isActive: false,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "INACTIVE",
          module: "units",
          resourceType: "units",
          resourceId: unit.id,
          oldData: oldUnit,
          newData: unit,
        },
      });

      return unit;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "units",
      relatedId: disabledUnit.id,
      title: "Unit Inactivated",
      message: `${currentUser.name || "Someone"} inactivated unit ${
        disabledUnit.name
      }.`,
    });

    return successResponse({
      message: "Unit inactivated successfully",
      data: disabledUnit,
    });
  } catch (error) {
    console.error("DELETE /api/units/[id] error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return errorResponse({
        message:
          "Unit tidak bisa dihapus permanent karena masih digunakan oleh data lain. Gunakan inactive saja.",
        status: 409,
        errors: error.message,
      });
    }

    return errorResponse({
      message: error instanceof Error ? error.message : "Failed to delete unit",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
