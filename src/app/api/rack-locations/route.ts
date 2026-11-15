import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type CreateRackLocationBody = {
  warehouseId?: string;
  name?: string;
  code?: string;
  barcodeValue?: string | null;
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

function getRackLocationOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.RackLocationOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "name":
      return { name: order };

    case "code":
      return { code: order };

    case "warehouse":
      return {
        warehouse: {
          name: order,
        },
      };

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
    const auth = await requirePermission("rack_locations.view");

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
    const warehouseId = (searchParams.get("warehouseId") || "").trim();
    const isActive = (searchParams.get("isActive") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const skip = (page - 1) * limit;

    const where: Prisma.RackLocationWhereInput = {};

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          code: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          barcodeValue: {
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
        {
          warehouse: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          warehouse: {
            code: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (isActive === "true") {
      where.isActive = true;
    }

    if (isActive === "false") {
      where.isActive = false;
    }

    const [items, total] = await prisma.$transaction([
      prisma.rackLocation.findMany({
        where,
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: getRackLocationOrderBy(sortBy, sortOrder),
        skip,
        take: limit,
      }),

      prisma.rackLocation.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Rack locations retrieved successfully",
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
    console.error("GET /api/rack-locations error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch rack locations",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("rack_locations.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;
    const body = (await req.json()) as CreateRackLocationBody;

    const warehouseId = body.warehouseId?.trim();
    const name = body.name?.trim();
    const code = generateRackCode(body.code || body.name || "");
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? true;

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

    const barcodeValue =
      body.barcodeValue?.trim() ||
      generateRackBarcodeValue(warehouse.code, code);

    const existingRackLocation = await prisma.rackLocation.findFirst({
      where: {
        OR: [
          {
            code,
          },
          {
            barcodeValue,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (existingRackLocation) {
      return errorResponse({
        message: "Rack location code atau barcode sudah digunakan",
        status: 409,
      });
    }

    const rackLocation = await prisma.$transaction(async (tx) => {
      const createdRackLocation = await tx.rackLocation.create({
        data: {
          warehouseId,
          name,
          code,
          barcodeValue,
          description,
          isActive,
        },
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "CREATE",
          module: "rack_locations",
          resourceType: "rack_locations",
          resourceId: createdRackLocation.id,
          oldData: Prisma.JsonNull,
          newData: createdRackLocation,
        },
      });

      return createdRackLocation;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "CREATE",
      module: "rack_locations",
      relatedId: rackLocation.id,
      title: "Rack Location Created",
      message: `${currentUser.name || "Someone"} created rack location ${
        rackLocation.name
      }.`,
    });

    return successResponse({
      message: "Rack location created successfully",
      data: rackLocation,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/rack-locations error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to create rack location",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
