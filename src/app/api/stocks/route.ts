import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

function getOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.ProductOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "sku":
      return { sku: order };
    case "name":
      return { name: order };
    case "currentStock":
      return { currentStock: order };
    case "minStock":
      return { minStock: order };
    case "category":
      return { category: { name: order } };
    case "brand":
      return { brand: { name: order } };
    default:
      return { name: "asc" };
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("stocks.view");

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
    const categoryId = (searchParams.get("categoryId") || "").trim();
    const brandId = (searchParams.get("brandId") || "").trim();
    const warehouseId = (searchParams.get("warehouseId") || "").trim();
    const stockStatus = (searchParams.get("stockStatus") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "name").trim();
    const sortOrder = (searchParams.get("sortOrder") || "asc").trim();

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = Number.isNaN(limit) || limit < 1 ? 10 : limit;
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (warehouseId) where.warehouseId = warehouseId;

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, shortName: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        rackLocation: { select: { id: true, name: true, code: true } },
        stockMovements: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            type: true,
            quantity: true,
            referenceType: true,
            createdAt: true,
          },
        },
      },
      orderBy: getOrderBy(sortBy, sortOrder),
    });

    let rows = products.map((product) => {
      const computedStockStatus =
        product.currentStock === 0
          ? "OUT_OF_STOCK"
          : product.currentStock <= product.minStock
            ? "LOW_STOCK"
            : "NORMAL";

      return {
        id: product.id,
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        category: product.category,
        brand: product.brand,
        unit: product.unit,
        warehouse: product.warehouse,
        rackLocation: product.rackLocation,
        currentStock: product.currentStock,
        minStock: product.minStock,
        stockStatus: computedStockStatus,
        lastMovement: product.stockMovements[0] || null,
      };
    });

    if (stockStatus) {
      rows = rows.filter((row) => row.stockStatus === stockStatus);
    }

    const total = rows.length;
    const paginatedRows = rows.slice(skip, skip + safeLimit);

    return successResponse({
      message: "Stocks retrieved successfully",
      data: {
        items: paginatedRows,
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
    console.error("GET /api/stocks error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to fetch stocks",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
