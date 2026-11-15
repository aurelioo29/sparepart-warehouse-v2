import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value || 0);
}

function normalizeLimit(value: number) {
  if (Number.isNaN(value) || value < 1) return 50;
  if (value > 200) return 200;

  return value;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page") || 1);
    const limit = normalizeLimit(Number(searchParams.get("limit") || 50));

    const search = (searchParams.get("search") || "").trim();
    const categoryId = (searchParams.get("categoryId") || "").trim();

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const skip = (safePage - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        {
          sku: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          category: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          brand: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [items, total, categories] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          sku: true,
          name: true,
          currentStock: true,
          sellingPrice: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
            },
          },
          unit: {
            select: {
              id: true,
              name: true,
              shortName: true,
            },
          },
        },
        orderBy: [
          {
            category: {
              name: "asc",
            },
          },
          {
            name: "asc",
          },
          {
            sku: "asc",
          },
        ],
        skip,
        take: limit,
      }),

      prisma.product.count({
        where,
      }),

      prisma.category.findMany({
        where: {
          products: {
            some: {
              isActive: true,
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    return successResponse({
      message: "Public price list retrieved successfully",
      data: {
        items: items.map((item) => ({
          ...item,
          currentStock: Number(item.currentStock || 0),
          sellingPrice: toNumber(item.sellingPrice),
        })),
        categories,
        meta: {
          page: safePage,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/public/price-list error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch public price list",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
