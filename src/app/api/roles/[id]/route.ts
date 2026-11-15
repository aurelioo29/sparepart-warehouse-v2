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

type UpdateRoleBody = {
  name?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  permissionIds?: string[];
};

const roleDetailSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,

  _count: {
    select: {
      users: true,
      rolePermissions: true,
    },
  },

  users: {
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      isActive: true,
    },
    orderBy: {
      fullName: "asc" as const,
    },
    take: 100,
  },

  rolePermissions: {
    select: {
      permissionId: true,

      permission: {
        select: {
          id: true,
          name: true,
          key: true,
          module: true,
        },
      },
    },
    orderBy: {
      permission: {
        key: "asc" as const,
      },
    },
  },
} satisfies Prisma.RoleSelect;

function normalizePermissionIds(permissionIds?: string[]) {
  return Array.from(
    new Set((permissionIds || []).map((id) => id.trim()).filter(Boolean)),
  );
}

async function validatePermissionIds(permissionIds: string[]) {
  if (permissionIds.length === 0) return;

  const total = await prisma.permission.count({
    where: {
      id: {
        in: permissionIds,
      },
    },
  });

  if (total !== permissionIds.length) {
    throw new Error("Ada permission yang tidak valid");
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("roles.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const role = await prisma.role.findUnique({
      where: {
        id,
      },
      select: roleDetailSelect,
    });

    if (!role) {
      return errorResponse({
        message: "Role tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Role retrieved successfully",
      data: role,
    });
  } catch (error) {
    console.error("GET /api/roles/[id] error:", error);

    return errorResponse({
      message: "Failed to fetch role",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("roles.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;
    const body = (await request.json()) as UpdateRoleBody;

    const oldRole = await prisma.role.findUnique({
      where: {
        id,
      },
      select: roleDetailSelect,
    });

    if (!oldRole) {
      return errorResponse({
        message: "Role tidak ditemukan",
        status: 404,
      });
    }

    const name = body.name?.trim();

    const requestedSlug = body.slug?.trim().toLowerCase();

    const slug = oldRole.slug === "superadmin" ? "superadmin" : requestedSlug;

    const description = body.description?.trim() || null;

    const isActive =
      oldRole.slug === "superadmin"
        ? true
        : (body.isActive ?? oldRole.isActive);

    const permissionIds = normalizePermissionIds(body.permissionIds);

    if (!name || !slug) {
      return errorResponse({
        message: "Name and slug are required",
        status: 400,
      });
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return errorResponse({
        message: "Format slug tidak valid",
        status: 400,
      });
    }

    const duplicateRole = await prisma.role.findFirst({
      where: {
        id: {
          not: id,
        },
        slug,
      },
      select: {
        id: true,
      },
    });

    if (duplicateRole) {
      return errorResponse({
        message: "Slug sudah digunakan",
        status: 409,
      });
    }

    await validatePermissionIds(permissionIds);

    const updatedRole = await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: {
          roleId: id,
        },
      });

      await tx.role.update({
        where: {
          id,
        },
        data: {
          name,
          slug,
          description,
          isActive,

          rolePermissions: {
            create: permissionIds.map((permissionId) => ({
              permissionId,
            })),
          },
        },
      });

      return tx.role.findUnique({
        where: {
          id,
        },
        select: roleDetailSelect,
      });
    });

    if (!updatedRole) {
      return errorResponse({
        message: "Gagal update role",
        status: 500,
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "UPDATE",
        module: "roles",
        resourceType: "roles",
        resourceId: id,
        oldData: oldRole,
        newData: updatedRole,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "UPDATE",
      module: "roles",
      relatedId: id,
      title: "Role Updated",
      message: `${
        auth.user.name || "Someone"
      } updated role ${updatedRole.name}.`,
    });

    return successResponse({
      message: "Role updated successfully",
      data: updatedRole,
    });
  } catch (error) {
    console.error("PATCH /api/roles/[id] error:", error);

    return errorResponse({
      message: error instanceof Error ? error.message : "Failed to update role",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("roles.delete");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const oldRole = await prisma.role.findUnique({
      where: {
        id,
      },
      select: roleDetailSelect,
    });

    if (!oldRole) {
      return errorResponse({
        message: "Role tidak ditemukan",
        status: 404,
      });
    }

    if (oldRole.slug === "superadmin") {
      return errorResponse({
        message: "Role superadmin tidak boleh dinonaktifkan",
        status: 400,
      });
    }

    if (oldRole._count.users > 0) {
      return errorResponse({
        message: "Role masih digunakan oleh user",
        status: 400,
      });
    }

    const disabledRole = await prisma.role.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "DELETE",
        module: "roles",
        resourceType: "roles",
        resourceId: id,
        oldData: oldRole,
        newData: disabledRole,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "DELETE",
      module: "roles",
      relatedId: id,
      title: "Role Disabled",
      message: `${
        auth.user.name || "Someone"
      } disabled role ${disabledRole.name}.`,
    });

    return successResponse({
      message: "Role disabled successfully",
      data: disabledRole,
    });
  } catch (error) {
    console.error("DELETE /api/roles/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to disable role",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
