import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type AdjustmentItemBody = {
  productId?: string;
  warehouseId?: string | null;
  rackLocationId?: string | null;
  stockAfter?: number | string;
  notes?: string | null;
};

type CreateAdjustmentBody = {
  documentNumber?: string | null;
  adjustmentDate?: string | null;
  reason?: string | null;
  notes?: string | null;
  items?: AdjustmentItemBody[];
};

const reasons = [
  "STOCK_OPNAME",
  "DAMAGED",
  "LOST",
  "FOUND",
  "INPUT_ERROR",
  "OTHER",
] as const;

type AdjustmentReason = (typeof reasons)[number];

function isReason(value: string): value is AdjustmentReason {
  return reasons.includes(value as AdjustmentReason);
}

function nullableId(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function parseDate(value: unknown) {
  if (!value) return new Date();

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal adjustment tidak valid");
  }

  return date;
}

function parseStockAfter(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new Error("Stock after harus angka bulat minimal 0");
  }

  return numberValue;
}

async function generateDocumentNumber(tx: Prisma.TransactionClient) {
  const today = new Date();

  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  const prefix = `ADJ-${yyyy}${mm}${dd}`;

  const count = await tx.stockAdjustment.count({
    where: {
      documentNumber: {
        startsWith: prefix,
      },
    },
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("stock_adjustments.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { searchParams } = new URL(req.url);

    const search = (searchParams.get("search") || "").trim();
    const reason = (searchParams.get("reason") || "").trim();
    const status = (searchParams.get("status") || "").trim();
    const startDate = (searchParams.get("startDate") || "").trim();
    const endDate = (searchParams.get("endDate") || "").trim();

    const where: Prisma.StockAdjustmentWhereInput = {};

    if (search) {
      where.OR = [
        {
          documentNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          notes: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          createdBy: {
            OR: [
              {
                fullName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                username: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          },
        },
      ];
    }

    if (reason && isReason(reason)) {
      where.reason = reason;
    }

    if (status === "POSTED" || status === "CANCELLED") {
      where.status = status;
    }

    if (startDate || endDate) {
      where.adjustmentDate = {};

      if (startDate) {
        where.adjustmentDate.gte = new Date(`${startDate}T00:00:00.000Z`);
      }

      if (endDate) {
        const nextDay = new Date(`${endDate}T00:00:00.000Z`);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);

        where.adjustmentDate.lt = nextDay;
      }
    }

    const items = await prisma.stockAdjustment.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: [
        {
          adjustmentDate: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    return successResponse({
      message: "Stock adjustments retrieved successfully",
      data: {
        items,
      },
    });
  } catch (error) {
    console.error("GET /api/stock-adjustments error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch stock adjustments",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("stock_adjustments.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const body = (await req.json()) as CreateAdjustmentBody;

    const adjustmentDate = parseDate(body.adjustmentDate);
    const reason = body.reason?.trim() || "OTHER";
    const notes = body.notes?.trim() || null;
    const items = body.items || [];

    if (!isReason(reason)) {
      return errorResponse({
        message: "Reason adjustment tidak valid",
        status: 400,
      });
    }

    if (items.length === 0) {
      return errorResponse({
        message: "Minimal harus ada 1 item adjustment",
        status: 400,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let documentNumber = body.documentNumber?.trim().toUpperCase() || "";

      if (!documentNumber) {
        documentNumber = await generateDocumentNumber(tx);
      }

      const duplicate = await tx.stockAdjustment.findUnique({
        where: {
          documentNumber,
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        throw new Error("Nomor dokumen adjustment sudah digunakan");
      }

      const adjustment = await tx.stockAdjustment.create({
        data: {
          documentNumber,
          adjustmentDate,
          reason,
          status: "POSTED",
          notes,
          createdById: currentUser.id,
          postedAt: new Date(),
        },
      });

      for (const rawItem of items) {
        const productId = rawItem.productId?.trim();
        const warehouseId = nullableId(rawItem.warehouseId);
        const rackLocationId = nullableId(rawItem.rackLocationId);
        const stockAfter = parseStockAfter(rawItem.stockAfter);
        const itemNotes = rawItem.notes?.trim() || null;

        if (!productId) {
          throw new Error("Product wajib dipilih");
        }

        const product = await tx.product.findUnique({
          where: {
            id: productId,
          },
          select: {
            id: true,
            name: true,
            currentStock: true,
          },
        });

        if (!product) {
          throw new Error("Product tidak ditemukan");
        }

        const stockBefore = product.currentStock;
        const difference = stockAfter - stockBefore;

        await tx.stockAdjustmentItem.create({
          data: {
            stockAdjustmentId: adjustment.id,
            productId,
            warehouseId,
            rackLocationId,
            stockBefore,
            stockAfter,
            difference,
            notes: itemNotes,
          },
        });

        await tx.product.update({
          where: {
            id: productId,
          },
          data: {
            currentStock: stockAfter,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId,
            warehouseId,
            rackLocationId,
            type: "ADJUSTMENT",
            quantity: Math.abs(difference),
            stockBefore,
            stockAfter,
            referenceType: "ADJUSTMENT",
            referenceId: adjustment.id,
            notes: `Adjustment ${documentNumber}`,
            createdById: currentUser.id,
          },
        });
      }

      return tx.stockAdjustment.findUnique({
        where: {
          id: adjustment.id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });

    if (!result) {
      return errorResponse({
        message: "Gagal membuat stock adjustment",
        status: 500,
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        module: "stock_adjustments",
        resourceType: "stock_adjustments",
        resourceId: result.id,
        oldData: Prisma.JsonNull,
        newData: result,
      },
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "CREATE",
      module: "stock_adjustments",
      relatedId: result.id,
      title: "Stock Adjustment Created",
      message: `${
        currentUser.name || "Someone"
      } created stock adjustment ${result.documentNumber}.`,
    });

    return successResponse({
      message: "Stock adjustment created successfully",
      data: result,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/stock-adjustments error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to create stock adjustment",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
