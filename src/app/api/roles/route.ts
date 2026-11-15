import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type CreateRoleBody = {
  name?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  permissionIds?: string[];
};

function getRoleOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.RoleOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "name":
      return {
        name: order,
      };

    case "slug":
      return {
        slug: order,
      };

    case "isActive":
      return {
        isActive: order,
      };

    case "updatedAt":
      return {
        updatedAt: order,
      };

    case "createdAt":
    default:
      return {
        createdAt: order,
      };
  }
}

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

export async function GET(request: Request) {
  try {
    const auth = await requirePermission("roles.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { searchParams } = new URL(request.url);

    const pageValue = Number(searchParams.get("page") || 1);

    const limitValue = Number(searchParams.get("limit") || 10);

    const page = Number.isNaN(pageValue) || pageValue < 1 ? 1 : pageValue;

    const limit =
      Number.isNaN(limitValue) || limitValue < 1
        ? 10
        : Math.min(limitValue, 100);

    const search = (searchParams.get("search") || "").trim();

    const isActive = (searchParams.get("isActive") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();

    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const skip = (page - 1) * limit;

    const where: Prisma.RoleWhereInput = {};

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          slug: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (isActive === "true") {
      where.isActive = true;
    }

    if (isActive === "false") {
      where.isActive = false;
    }

    const [items, total] = await prisma.$transaction([
      prisma.role.findMany({
        where,
        select: {
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
        },
        orderBy: getRoleOrderBy(sortBy, sortOrder),
        skip,
        take: limit,
      }),

      prisma.role.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Roles retrieved successfully",
      data: {
        items,

        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/roles error:", error);

    return errorResponse({
      message: "Failed to fetch roles",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission("roles.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const body = (await request.json()) as CreateRoleBody;

    const name = body.name?.trim();
    const slug = body.slug?.trim().toLowerCase();

    const description = body.description?.trim() || null;

    const isActive = body.isActive ?? true;

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

    const existingRole = await prisma.role.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    });

    if (existingRole) {
      return errorResponse({
        message: "Slug sudah digunakan",
        status: 409,
      });
    }

    await validatePermissionIds(permissionIds);

    const role = await prisma.role.create({
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

      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "CREATE",
        module: "roles",
        resourceType: "roles",
        resourceId: role.id,
        oldData: Prisma.JsonNull,
        newData: role,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "CREATE",
      module: "roles",
      relatedId: role.id,
      title: "Role Created",
      message: `${auth.user.name || "Someone"} created role ${role.name}.`,
    });

    return successResponse({
      message: "Role created successfully",
      data: role,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/roles error:", error);

    return errorResponse({
      message: error instanceof Error ? error.message : "Failed to create role",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
