import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type CreatePermissionBody = {
  name?: string;
  key?: string;
  module?: string;
};

function getPermissionOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.PermissionOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "name":
      return { name: order };
    case "key":
      return { key: order };
    case "module":
      return { module: order };
    case "updatedAt":
      return { updatedAt: order };
    case "createdAt":
    default:
      return { createdAt: order };
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("permissions.view");

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
    const moduleName = (searchParams.get("module") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const skip = (page - 1) * limit;

    const where: Prisma.PermissionWhereInput = {};

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          key: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          module: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (moduleName) {
      where.module = {
        contains: moduleName,
        mode: "insensitive",
      };
    }

    const [items, total] = await prisma.$transaction([
      prisma.permission.findMany({
        where,
        select: {
          id: true,
          name: true,
          key: true,
          module: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              rolePermissions: true,
            },
          },
        },
        orderBy: getPermissionOrderBy(sortBy, sortOrder),
        skip,
        take: limit,
      }),

      prisma.permission.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Permissions retrieved successfully",
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
    console.error("GET /api/permissions error:", error);

    return errorResponse({
      message: "Failed to fetch permissions",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("permissions.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const body = (await req.json()) as CreatePermissionBody;

    const name = body.name?.trim();
    const key = body.key?.trim().toLowerCase();
    const moduleName = body.module?.trim().toLowerCase();

    if (!name || !key || !moduleName) {
      return errorResponse({
        message: "Name, key, and module are required",
        status: 400,
      });
    }

    const existingPermission = await prisma.permission.findUnique({
      where: {
        key,
      },
      select: {
        id: true,
      },
    });

    if (existingPermission) {
      return errorResponse({
        message: "Permission key sudah digunakan",
        status: 409,
      });
    }

    const permission = await prisma.permission.create({
      data: {
        name,
        key,
        module: moduleName,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "CREATE",
        module: "permissions",
        resourceType: "permissions",
        resourceId: permission.id,
        oldData: Prisma.JsonNull,
        newData: permission,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "CREATE",
      module: "permissions",
      relatedId: permission.id,
      title: "Permission Created",
      message: `${auth.user.name || "Someone"} created permission ${
        permission.key
      }.`,
    });

    return successResponse({
      message: "Permission created successfully",
      data: permission,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/permissions error:", error);

    return errorResponse({
      message: "Failed to create permission",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
