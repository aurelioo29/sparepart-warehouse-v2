import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type CreateGeneralSettingBody = {
  key?: string;
  value?: unknown;
  type?: string;
  group?: string;
  description?: string | null;
  isPublic?: boolean;
};

function getGeneralSettingOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.GeneralSettingOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "key":
      return { key: order };
    case "type":
      return { type: order };
    case "group":
      return { group: order };
    case "isPublic":
      return { isPublic: order };
    case "updatedAt":
      return { updatedAt: order };
    case "createdAt":
    default:
      return { createdAt: order };
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("settings.view");

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
    const groupName = (searchParams.get("group") || "").trim();
    const type = (searchParams.get("type") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const skip = (page - 1) * limit;

    const where: Prisma.GeneralSettingWhereInput = {};

    if (search) {
      where.OR = [
        {
          key: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          group: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          type: {
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

    if (groupName) {
      where.group = {
        contains: groupName,
        mode: "insensitive",
      };
    }

    if (type) {
      where.type = type;
    }

    const [items, total] = await prisma.$transaction([
      prisma.generalSetting.findMany({
        where,
        orderBy: getGeneralSettingOrderBy(sortBy, sortOrder),
        skip,
        take: limit,
      }),

      prisma.generalSetting.count({
        where,
      }),
    ]);

    return successResponse({
      message: "General settings retrieved successfully",
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
    console.error("GET /api/settings/general error:", error);

    return errorResponse({
      message: "Failed to fetch general settings",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("settings.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const body = (await req.json()) as CreateGeneralSettingBody;

    const key = body.key?.trim().toLowerCase();
    const type = body.type?.trim().toLowerCase();
    const groupName = body.group?.trim().toLowerCase();
    const description = body.description?.trim() || null;
    const isPublic = body.isPublic ?? false;

    if (!key || !type || !groupName) {
      return errorResponse({
        message: "Key, type, and group are required",
        status: 400,
      });
    }

    const existingSetting = await prisma.generalSetting.findUnique({
      where: {
        key,
      },
      select: {
        id: true,
      },
    });

    if (existingSetting) {
      return errorResponse({
        message: "Setting key sudah digunakan",
        status: 409,
      });
    }

    const setting = await prisma.generalSetting.create({
      data: {
        key,
        value: body.value as Prisma.InputJsonValue,
        type,
        group: groupName,
        description,
        isPublic,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "CREATE",
        module: "general_settings",
        resourceType: "general_settings",
        resourceId: setting.id,
        oldData: Prisma.JsonNull,
        newData: setting,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "CREATE",
      module: "general_settings",
      relatedId: setting.id,
      title: "General Setting Created",
      message: `${auth.user.name || "Someone"} created setting ${setting.key}.`,
    });

    return successResponse({
      message: "General setting created successfully",
      data: setting,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/settings/general error:", error);

    return errorResponse({
      message: "Failed to create general setting",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
