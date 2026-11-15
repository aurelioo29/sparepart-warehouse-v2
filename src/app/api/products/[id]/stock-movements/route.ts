import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function getStockMovementOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.StockMovementOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
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

function toValidMovementType(value: string) {
  if (value === "IN" || value === "OUT" || value === "ADJUSTMENT") {
    return value;
  }

  return null;
}

function toValidReferenceType(value: string) {
  if (
    value === "STOCK_IN" ||
    value === "STOCK_OUT" ||
    value === "SALE" ||
    value === "SALE_RETURN" ||
    value === "ADJUSTMENT"
  ) {
    return value;
  }

  return null;
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("products.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);

    const type = (searchParams.get("type") || "").trim();
    const referenceType = (searchParams.get("referenceType") || "").trim();
    const warehouseId = (searchParams.get("warehouseId") || "").trim();
    const rackLocationId = (searchParams.get("rackLocationId") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();

    /**
     * false = default audit bersih:
     * hide movement dari Stock In yang sudah CANCELLED.
     *
     * true = ledger full:
     * tampilkan semua movement, termasuk IN awal dan OUT pembatalan.
     */
    const showCancelledReferences =
      searchParams.get("showCancelledReferences") === "true";

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = Number.isNaN(limit) || limit < 1 ? 10 : limit;
    const skip = (safePage - 1) * safeLimit;

    const product = await prisma.product.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        currentStock: true,
        unit: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
      },
    });

    if (!product) {
      return errorResponse({
        message: "Product tidak ditemukan",
        status: 404,
      });
    }

    const where: Prisma.StockMovementWhereInput = {
      productId: id,
    };

    const validType = toValidMovementType(type);
    const validReferenceType = toValidReferenceType(referenceType);

    if (validType) {
      where.type = validType;
    }

    if (validReferenceType) {
      where.referenceType = validReferenceType;
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

    /**
     * Ambil semua movement dulu untuk product ini supaya kita bisa:
     * - mapping reference Stock In status
     * - hide cancelled reference
     * - hitung summary yang manusiawi
     */
    const allMovements = await prisma.stockMovement.findMany({
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
    });

    const stockInReferenceIds = Array.from(
      new Set(
        allMovements
          .filter(
            (movement) =>
              movement.referenceType === "STOCK_IN" && movement.referenceId,
          )
          .map((movement) => movement.referenceId as string),
      ),
    );

    const stockIns = await prisma.stockIn.findMany({
      where: {
        id: {
          in: stockInReferenceIds,
        },
      },
      select: {
        id: true,
        documentNumber: true,
        status: true,
        cancelledAt: true,
      },
    });

    const stockInMap = new Map(
      stockIns.map((stockIn) => [stockIn.id, stockIn]),
    );

    const enrichedMovements = allMovements.map((movement) => {
      const stockIn =
        movement.referenceType === "STOCK_IN" && movement.referenceId
          ? stockInMap.get(movement.referenceId)
          : null;

      const referenceStatus = stockIn?.status || null;
      const referenceDocumentNumber = stockIn?.documentNumber || null;
      const isCancelledReference = referenceStatus === "CANCELLED";

      return {
        ...movement,
        referenceStatus,
        referenceDocumentNumber,
        isCancelledReference,
      };
    });

    const visibleMovements = showCancelledReferences
      ? enrichedMovements
      : enrichedMovements.filter((movement) => !movement.isCancelledReference);

    const total = visibleMovements.length;

    const paginatedItems = visibleMovements.slice(skip, skip + safeLimit);

    const movementsAsc = [...visibleMovements].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const totalIn = movementsAsc
      .filter((movement) => movement.type === "IN")
      .reduce((sum, movement) => sum + movement.quantity, 0);

    const totalOut = movementsAsc
      .filter((movement) => movement.type === "OUT")
      .reduce((sum, movement) => sum + movement.quantity, 0);

    const totalAdjustmentDelta = movementsAsc
      .filter((movement) => movement.type === "ADJUSTMENT")
      .reduce(
        (sum, movement) => sum + (movement.stockAfter - movement.stockBefore),
        0,
      );

    const totalMovementDelta = movementsAsc.reduce(
      (sum, movement) => sum + (movement.stockAfter - movement.stockBefore),
      0,
    );

    const firstStockBefore =
      movementsAsc[0]?.stockBefore ?? product.currentStock;

    const calculatedFinalStock =
      movementsAsc.length > 0
        ? firstStockBefore + totalMovementDelta
        : product.currentStock;

    const latestMovementStockAfter =
      movementsAsc[movementsAsc.length - 1]?.stockAfter ?? null;

    const isFiltered = Boolean(
      type ||
      referenceType ||
      warehouseId ||
      rackLocationId ||
      dateFrom ||
      dateTo ||
      !showCancelledReferences,
    );

    const balanceDifference = showCancelledReferences
      ? product.currentStock - calculatedFinalStock
      : null;

    return successResponse({
      message: "Product stock movements retrieved successfully",
      data: {
        product,
        summary: {
          totalIn,
          totalOut,
          totalAdjustmentDelta,
          totalMovementDelta,
          firstStockBefore,
          calculatedFinalStock,
          latestMovementStockAfter,
          currentStock: product.currentStock,
          balanceDifference,
          isBalanced: showCancelledReferences ? balanceDifference === 0 : null,
          isFiltered,
          showCancelledReferences,
          hiddenCancelledReferences:
            enrichedMovements.length - visibleMovements.length,
        },
        items: paginatedItems,
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
    console.error("GET /api/products/[id]/stock-movements error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch product stock movements",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
