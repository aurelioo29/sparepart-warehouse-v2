import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type CreateWarehouseBody = {
  name?: string;
  code?: string;
  address?: string | null;
  description?: string | null;
  isActive?: boolean;
};

function getWarehouseOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.WarehouseOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "name":
      return { name: order };
    case "code":
      return { code: order };
    case "isActive":
      return { isActive: order };
    case "updatedAt":
      return { updatedAt: order };
    case "createdAt":
    default:
      return { createdAt: order };
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("warehouses.view");

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
    const isActive = (searchParams.get("isActive") || "").trim();
    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const skip = (page - 1) * limit;

    const where: Prisma.WarehouseWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive === "true") where.isActive = true;
    if (isActive === "false") where.isActive = false;

    const [items, total] = await prisma.$transaction([
      prisma.warehouse.findMany({
        where,
        include: {
          _count: {
            select: {
              rackLocations: true,
            },
          },
        },
        orderBy: getWarehouseOrderBy(sortBy, sortOrder),
        skip,
        take: limit,
      }),
      prisma.warehouse.count({ where }),
    ]);

    return successResponse({
      message: "Warehouses retrieved successfully",
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
    console.error("GET /api/warehouses error:", error);

    return errorResponse({
      message: "Failed to fetch warehouses",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("warehouses.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const body = (await req.json()) as CreateWarehouseBody;

    const name = body.name?.trim();
    const code = body.code?.trim().toUpperCase();
    const address = body.address?.trim() || null;
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? true;

    if (!name || !code) {
      return errorResponse({
        message: "Name and code are required",
        status: 400,
      });
    }

    const existingWarehouse = await prisma.warehouse.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existingWarehouse) {
      return errorResponse({
        message: "Warehouse code sudah digunakan",
        status: 409,
      });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name,
        code,
        address,
        description,
        isActive,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "CREATE",
        module: "warehouses",
        resourceType: "warehouses",
        resourceId: warehouse.id,
        oldData: Prisma.JsonNull,
        newData: warehouse,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "CREATE",
      module: "warehouses",
      relatedId: warehouse.id,
      title: "Warehouse Created",
      message: `${auth.user.name || "Someone"} created warehouse ${
        warehouse.name
      }.`,
    });

    return successResponse({
      message: "Warehouse created successfully",
      data: warehouse,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/warehouses error:", error);

    return errorResponse({
      message: "Failed to create warehouse",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
