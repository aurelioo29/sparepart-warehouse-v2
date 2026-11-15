import bcrypt from "bcryptjs";
import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type CustomPermissionBody = {
  permissionId?: string;
  effect?: "ALLOW" | "DENY";
};

type CreateUserBody = {
  roleId?: string;
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string;
  password?: string;
  isActive?: boolean;
  customPermissions?: CustomPermissionBody[];
};

function getUserOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.UserOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "fullName":
      return { fullName: order };

    case "username":
      return { username: order };

    case "email":
      return { email: order };

    case "phone":
      return { phone: order };

    case "role":
      return {
        role: {
          name: order,
        },
      };

    case "isActive":
      return { isActive: order };

    case "lastLoginAt":
      return { lastLoginAt: order };

    case "updatedAt":
      return { updatedAt: order };

    case "createdAt":
    default:
      return { createdAt: order };
  }
}

function normalizeCustomPermissions(
  customPermissions: CustomPermissionBody[] | undefined,
) {
  const safeItems = customPermissions || [];

  const normalized = safeItems
    .map((item) => ({
      permissionId: item.permissionId?.trim() || "",
      effect: item.effect,
    }))
    .filter((item) => item.permissionId && item.effect);

  const invalidEffect = normalized.find(
    (item) => item.effect !== "ALLOW" && item.effect !== "DENY",
  );

  if (invalidEffect) {
    throw new Error("Custom permission effect tidak valid");
  }

  const uniqueMap = new Map<string, "ALLOW" | "DENY">();

  for (const item of normalized) {
    uniqueMap.set(item.permissionId, item.effect as "ALLOW" | "DENY");
  }

  return Array.from(uniqueMap.entries()).map(([permissionId, effect]) => ({
    permissionId,
    effect,
  }));
}

async function validatePermissionIds(permissionIds: string[]) {
  if (permissionIds.length === 0) return;

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

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("users.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);

    const search = (searchParams.get("search") || "").trim();
    const roleId = (searchParams.get("roleId") || "").trim();
    const isActive = (searchParams.get("isActive") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = Number.isNaN(limit) || limit < 1 ? 10 : limit;
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        {
          fullName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          username: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (roleId) {
      where.roleId = roleId;
    }

    if (isActive === "true") {
      where.isActive = true;
    }

    if (isActive === "false") {
      where.isActive = false;
    }

    const orderBy = getUserOrderBy(sortBy, sortOrder);

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
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
                key: "asc",
              },
            },
          },
        },
        orderBy,
        skip,
        take: safeLimit,
      }),

      prisma.user.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Users retrieved successfully",
      data: {
        items,
        meta: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/users error:", error);

    return errorResponse({
      message: "Failed to fetch users",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("users.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const body = (await req.json()) as CreateUserBody;

    const roleId = body.roleId?.trim();
    const fullName = body.fullName?.trim();
    const username = body.username?.trim().toLowerCase();
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.trim() || null;
    const password = body.password || "";
    const isActive = body.isActive ?? true;
    const customPermissions = normalizeCustomPermissions(
      body.customPermissions,
    );

    if (!roleId || !fullName || !username || !email || !password) {
      return errorResponse({
        message: "Role, full name, username, email, and password are required",
        status: 400,
      });
    }

    if (password.length < 6) {
      return errorResponse({
        message: "Password minimal 6 karakter",
        status: 400,
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    if (existingUser) {
      return errorResponse({
        message: "Username atau email sudah digunakan",
        status: 409,
      });
    }

    const role = await prisma.role.findUnique({
      where: {
        id: roleId,
      },
    });

    if (!role) {
      return errorResponse({
        message: "Role tidak ditemukan",
        status: 404,
      });
    }

    await validatePermissionIds(
      customPermissions.map((item) => item.permissionId),
    );

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          roleId,
          fullName,
          username,
          email,
          phone,
          passwordHash,
          isActive,
        },
      });

      if (customPermissions.length > 0) {
        await tx.userPermission.createMany({
          data: customPermissions.map((item) => ({
            userId: createdUser.id,
            permissionId: item.permissionId,
            effect: item.effect,
          })),
          skipDuplicates: true,
        });
      }

      return tx.user.findUnique({
        where: {
          id: createdUser.id,
        },
        select: {
          id: true,
          roleId: true,
          fullName: true,
          username: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
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
                key: "asc",
              },
            },
          },
        },
      });
    });

    if (!user) {
      return errorResponse({
        message: "Gagal membuat user",
        status: 500,
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "CREATE",
        module: "users",
        resourceType: "users",
        resourceId: user.id,
        oldData: Prisma.JsonNull,
        newData: user,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "CREATE",
      module: "users",
      relatedId: user.id,
      title: "User Created",
      message: `${auth.user.name || "Someone"} created user ${user.fullName}.`,
    });

    return successResponse({
      message: "User created successfully",
      data: user,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/users error:", error);

    return errorResponse({
      message: error instanceof Error ? error.message : "Failed to create user",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
