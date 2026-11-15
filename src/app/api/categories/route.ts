import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";
import { slugify } from "@/lib/slug";

type CreateCategoryBody = {
  name?: string;
  description?: string | null;
  isActive?: boolean;
};

function getCategoryOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.CategoryOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "name":
      return { name: order };

    case "slug":
      return { slug: order };

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
    const auth = await requirePermission("categories.view");

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

    const where: Prisma.CategoryWhereInput = {};

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
      prisma.category.findMany({
        where,
        orderBy: getCategoryOrderBy(sortBy, sortOrder),
        skip,
        take: limit,
      }),

      prisma.category.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Categories retrieved successfully",
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
    console.error("GET /api/categories error:", error);

    return errorResponse({
      message: "Failed to fetch categories",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("categories.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const body = (await req.json()) as CreateCategoryBody;

    const name = body.name?.trim();
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? true;

    if (!name) {
      return errorResponse({
        message: "Name is required",
        status: 400,
      });
    }

    const slug = slugify(name);

    if (!slug) {
      return errorResponse({
        message: "Name tidak valid untuk dibuat slug",
        status: 400,
      });
    }

    const existingCategory = await prisma.category.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    });

    if (existingCategory) {
      return errorResponse({
        message: "Category dengan nama tersebut sudah ada",
        status: 409,
      });
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        isActive,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "CREATE",
        module: "categories",
        resourceType: "categories",
        resourceId: category.id,
        oldData: Prisma.JsonNull,
        newData: category,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "CREATE",
      module: "categories",
      relatedId: category.id,
      title: "Category Created",
      message: `${auth.user.name || "Someone"} created category ${
        category.name
      }.`,
    });

    return successResponse({
      message: "Category created successfully",
      data: category,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/categories error:", error);

    return errorResponse({
      message: "Failed to create category",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
