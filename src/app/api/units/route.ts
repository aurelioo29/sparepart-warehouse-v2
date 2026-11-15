import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type CreateUnitBody = {
  name?: string;
  shortName?: string;
  description?: string | null;
  isActive?: boolean;
};

function getUnitOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.UnitOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "name":
      return { name: order };

    case "shortName":
      return { shortName: order };

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
    const auth = await requirePermission("units.view");

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

    const where: Prisma.UnitWhereInput = {};

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          shortName: {
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
      prisma.unit.findMany({
        where,
        orderBy: getUnitOrderBy(sortBy, sortOrder),
        skip,
        take: limit,
      }),

      prisma.unit.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Units retrieved successfully",
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
    console.error("GET /api/units error:", error);

    return errorResponse({
      message: "Failed to fetch units",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("units.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const body = (await req.json()) as CreateUnitBody;

    const name = body.name?.trim();
    const shortName = body.shortName?.trim().toLowerCase();
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? true;

    if (!name || !shortName) {
      return errorResponse({
        message: "Name and short name are required",
        status: 400,
      });
    }

    const existingUnit = await prisma.unit.findUnique({
      where: {
        shortName,
      },
      select: {
        id: true,
      },
    });

    if (existingUnit) {
      return errorResponse({
        message: "Short name tersebut sudah digunakan",
        status: 409,
      });
    }

    const unit = await prisma.unit.create({
      data: {
        name,
        shortName,
        description,
        isActive,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "CREATE",
        module: "units",
        resourceType: "units",
        resourceId: unit.id,
        oldData: Prisma.JsonNull,
        newData: unit,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "CREATE",
      module: "units",
      relatedId: unit.id,
      title: "Unit Created",
      message: `${auth.user.name || "Someone"} created unit ${unit.name}.`,
    });

    return successResponse({
      message: "Unit created successfully",
      data: unit,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/units error:", error);

    return errorResponse({
      message: "Failed to create unit",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
