import bcrypt from "bcryptjs";
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

type CustomPermissionBody = {
  permissionId?: string;
  effect?: "ALLOW" | "DENY";
};

type UpdateUserBody = {
  roleId?: string;
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string | null;
  password?: string;
  isActive?: boolean;
  customPermissions?: CustomPermissionBody[];
};

const userSelect = {
  id: true,
  roleId: true,
  fullName: true,
  username: true,
  email: true,
  phone: true,
  avatarUrl: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,

  role: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },

  customPermissions: {
    select: {
      id: true,
      permissionId: true,
      effect: true,

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
} satisfies Prisma.UserSelect;

function normalizeCustomPermissions(
  customPermissions?: CustomPermissionBody[],
) {
  const uniquePermissions = new Map<string, "ALLOW" | "DENY">();

  for (const item of customPermissions || []) {
    const permissionId = item.permissionId?.trim();

    if (!permissionId) {
      continue;
    }

    if (item.effect !== "ALLOW" && item.effect !== "DENY") {
      throw new Error("Custom permission effect tidak valid");
    }

    uniquePermissions.set(permissionId, item.effect);
  }

  return Array.from(uniquePermissions, ([permissionId, effect]) => ({
    permissionId,
    effect,
  }));
}

async function validatePermissionIds(permissionIds: string[]) {
  if (permissionIds.length === 0) {
    return;
  }

  const totalPermissions = await prisma.permission.count({
    where: {
      id: {
        in: permissionIds,
      },
    },
  });

  if (totalPermissions !== permissionIds.length) {
    throw new Error("Ada permission yang tidak valid");
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("users.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
      select: userSelect,
    });

    if (!user) {
      return errorResponse({
        message: "User tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "User detail retrieved successfully",
      data: user,
    });
  } catch (error) {
    console.error("GET /api/users/[id] error:", error);

    return errorResponse({
      message: "Failed to fetch user detail",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("users.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;
    const body = (await request.json()) as UpdateUserBody;

    const existingUser = await prisma.user.findUnique({
      where: {
        id,
      },
      select: userSelect,
    });

    if (!existingUser) {
      return errorResponse({
        message: "User tidak ditemukan",
        status: 404,
      });
    }

    const roleId = body.roleId?.trim();
    const fullName = body.fullName?.trim();
    const username = body.username?.trim().toLowerCase();
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.trim() || null;
    const password = body.password?.trim();

    const customPermissions = normalizeCustomPermissions(
      body.customPermissions,
    );

    if (!roleId || !fullName || !username || !email) {
      return errorResponse({
        message: "Role, full name, username, dan email wajib diisi",
        status: 400,
      });
    }

    if (password && password.length < 6) {
      return errorResponse({
        message: "Password minimal 6 karakter",
        status: 400,
      });
    }

    if (id === auth.user.id && body.isActive === false) {
      return errorResponse({
        message: "Anda tidak dapat menonaktifkan akun sendiri",
        status: 400,
      });
    }

    const [role, duplicateUser] = await Promise.all([
      prisma.role.findUnique({
        where: {
          id: roleId,
        },
        select: {
          id: true,
        },
      }),

      prisma.user.findFirst({
        where: {
          id: {
            not: id,
          },
          OR: [
            {
              username,
            },
            {
              email,
            },
          ],
        },
        select: {
          id: true,
        },
      }),
    ]);

    if (!role) {
      return errorResponse({
        message: "Role tidak ditemukan",
        status: 404,
      });
    }

    if (duplicateUser) {
      return errorResponse({
        message: "Username atau email sudah digunakan",
        status: 409,
      });
    }

    await validatePermissionIds(
      customPermissions.map((permission) => permission.permissionId),
    );

    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id,
        },
        data: {
          roleId,
          fullName,
          username,
          email,
          phone,
          isActive: body.isActive ?? existingUser.isActive,

          ...(passwordHash
            ? {
                passwordHash,
              }
            : {}),
        },
      });

      await tx.userPermission.deleteMany({
        where: {
          userId: id,
        },
      });

      if (customPermissions.length > 0) {
        await tx.userPermission.createMany({
          data: customPermissions.map((permission) => ({
            userId: id,
            permissionId: permission.permissionId,
            effect: permission.effect,
          })),
        });
      }

      return tx.user.findUnique({
        where: {
          id,
        },
        select: userSelect,
      });
    });

    if (!updatedUser) {
      return errorResponse({
        message: "Gagal update user",
        status: 500,
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "UPDATE",
        module: "users",
        resourceType: "users",
        resourceId: id,
        oldData: existingUser,
        newData: updatedUser,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "UPDATE",
      module: "users",
      relatedId: id,
      title: "User Updated",
      message: `${
        auth.user.name || "Someone"
      } updated user ${updatedUser.fullName}.`,
    });

    return successResponse({
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("PATCH /api/users/[id] error:", error);

    return errorResponse({
      message: error instanceof Error ? error.message : "Failed to update user",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("users.delete");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    if (id === auth.user.id) {
      return errorResponse({
        message: "Anda tidak dapat menonaktifkan akun sendiri",
        status: 400,
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        id,
      },
      select: userSelect,
    });

    if (!existingUser) {
      return errorResponse({
        message: "User tidak ditemukan",
        status: 404,
      });
    }

    if (!existingUser.isActive) {
      return successResponse({
        message: "User sudah nonaktif",
        data: existingUser,
      });
    }

    const user = await prisma.user.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
      select: userSelect,
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "DELETE",
        module: "users",
        resourceType: "users",
        resourceId: id,
        oldData: existingUser,
        newData: user,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "DELETE",
      module: "users",
      relatedId: id,
      title: "User Disabled",
      message: `${auth.user.name || "Someone"} disabled user ${user.fullName}.`,
    });

    return successResponse({
      message: "User disabled successfully",
      data: user,
    });
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);

    return errorResponse({
      message: "Failed to disable user",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
