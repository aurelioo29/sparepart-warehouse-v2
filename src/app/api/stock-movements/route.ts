import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

function getStockMovementOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.StockMovementOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "product":
      return {
        product: {
          name: order,
        },
      };

    case "type":
      return { type: order };

    case "quantity":
      return { quantity: order };

    case "stockBefore":
      return { stockBefore: order };

    case "stockAfter":
      return { stockAfter: order };

    case "referenceType":
      return { referenceType: order };

    case "createdAt":
    default:
      return { createdAt: order };
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("stock_movements.view");

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
    const productId = (searchParams.get("productId") || "").trim();
    const type = (searchParams.get("type") || "").trim();
    const referenceType = (searchParams.get("referenceType") || "").trim();
    const warehouseId = (searchParams.get("warehouseId") || "").trim();
    const rackLocationId = (searchParams.get("rackLocationId") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = Number.isNaN(limit) || limit < 1 ? 10 : limit;
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.StockMovementWhereInput = {};

    if (search) {
      where.OR = [
        {
          product: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          product: {
            sku: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          notes: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (productId) {
      where.productId = productId;
    }

    if (type === "IN" || type === "OUT" || type === "ADJUSTMENT") {
      where.type = type;
    }

    if (
      referenceType === "STOCK_IN" ||
      referenceType === "STOCK_OUT" ||
      referenceType === "SALE" ||
      referenceType === "SALE_RETURN" ||
      referenceType === "ADJUSTMENT"
    ) {
      where.referenceType = referenceType;
    }

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (rackLocationId) {
      where.rackLocationId = rackLocationId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};

      if (dateFrom) {
        where.createdAt.gte = new Date(`${dateFrom}T00:00:00`);
      }

      if (dateTo) {
        where.createdAt.lte = new Date(`${dateTo}T23:59:59`);
      }
    }

    const [items, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
                },
              },
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          rackLocation: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
        },
        orderBy: getStockMovementOrderBy(sortBy, sortOrder),
        skip,
        take: safeLimit,
      }),

      prisma.stockMovement.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Stock movements retrieved successfully",
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
    console.error("GET /api/stock-movements error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch stock movements",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}