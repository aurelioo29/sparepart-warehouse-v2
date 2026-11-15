import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdatePermissionBody = {
  name?: string;
  key?: string;
  module?: string;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("permissions.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;
    const body = (await req.json()) as UpdatePermissionBody;

    const oldPermission = await prisma.permission.findUnique({
      where: {
        id,
      },
    });

    if (!oldPermission) {
      return errorResponse({
        message: "Permission tidak ditemukan",
        status: 404,
      });
    }

    const name = body.name?.trim();
    const key = body.key?.trim().toLowerCase();
    const moduleName = body.module?.trim().toLowerCase();

    if (!name || !key || !moduleName) {
      return errorResponse({
        message: "Name, key, and module are required",
        status: 400,
      });
    }

    const duplicatePermission = await prisma.permission.findFirst({
      where: {
        id: {
          not: id,
        },
        key,
      },
      select: {
        id: true,
      },
    });

    if (duplicatePermission) {
      return errorResponse({
        message: "Permission key sudah digunakan",
        status: 409,
      });
    }

    const updatedPermission = await prisma.permission.update({
      where: {
        id,
      },
      data: {
        name,
        key,
        module: moduleName,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "UPDATE",
        module: "permissions",
        resourceType: "permissions",
        resourceId: updatedPermission.id,
        oldData: oldPermission,
        newData: updatedPermission,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "UPDATE",
      module: "permissions",
      relatedId: updatedPermission.id,
      title: "Permission Updated",
      message: `${auth.user.name || "Someone"} updated permission ${
        updatedPermission.key
      }.`,
    });

    return successResponse({
      message: "Permission updated successfully",
      data: updatedPermission,
    });
  } catch (error) {
    console.error("PATCH /api/permissions/[id] error:", error);

    return errorResponse({
      message: "Failed to update permission",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("permissions.delete");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const oldPermission = await prisma.permission.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            rolePermissions: true,
          },
        },
      },
    });

    if (!oldPermission) {
      return errorResponse({
        message: "Permission tidak ditemukan",
        status: 404,
      });
    }

    if (oldPermission._count.rolePermissions > 0) {
      return errorResponse({
        message: "Permission masih digunakan oleh role",
        status: 400,
      });
    }

    const deletedPermission = await prisma.permission.delete({
      where: {
        id,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "DELETE",
        module: "permissions",
        resourceType: "permissions",
        resourceId: deletedPermission.id,
        oldData: oldPermission,
        newData: deletedPermission,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "DELETE",
      module: "permissions",
      relatedId: deletedPermission.id,
      title: "Permission Deleted",
      message: `${auth.user.name || "Someone"} deleted permission ${
        deletedPermission.key
      }.`,
    });

    return successResponse({
      message: "Permission deleted successfully",
      data: deletedPermission,
    });
  } catch (error) {
    console.error("DELETE /api/permissions/[id] error:", error);

    return errorResponse({
      message: "Failed to delete permission",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
