import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value || 0);
}

function getCurrentMonthRange() {
  const now = new Date();

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  return {
    start,
    end,
  };
}

export async function GET() {
  try {
    const auth = await requirePermission("stock_ins.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { start, end } = getCurrentMonthRange();

    const [
      totalPostedDocuments,
      totalCancelledDocuments,
      totalPurchaseAggregate,
      totalPaidAggregate,
      totalPayableAggregate,
      unpaidDocuments,
      partialDocuments,
      paidDocuments,
      currentMonthDocuments,
      currentMonthPurchaseAggregate,
      recentPurchases,
    ] = await prisma.$transaction([
      prisma.stockIn.count({
        where: {
          status: "POSTED",
        },
      }),

      prisma.stockIn.count({
        where: {
          status: "CANCELLED",
        },
      }),

      prisma.stockIn.aggregate({
        where: {
          status: "POSTED",
        },
        _sum: {
          totalAmount: true,
        },
      }),

      prisma.stockIn.aggregate({
        where: {
          status: "POSTED",
        },
        _sum: {
          paidAmount: true,
        },
      }),

      prisma.stockIn.aggregate({
        where: {
          status: "POSTED",
        },
        _sum: {
          remainingAmount: true,
        },
      }),

      prisma.stockIn.count({
        where: {
          status: "POSTED",
          paymentStatus: "UNPAID",
        },
      }),

      prisma.stockIn.count({
        where: {
          status: "POSTED",
          paymentStatus: "PARTIAL",
        },
      }),

      prisma.stockIn.count({
        where: {
          status: "POSTED",
          paymentStatus: "PAID",
        },
      }),

      prisma.stockIn.count({
        where: {
          status: "POSTED",
          stockInDate: {
            gte: start,
            lte: end,
          },
        },
      }),

      prisma.stockIn.aggregate({
        where: {
          status: "POSTED",
          stockInDate: {
            gte: start,
            lte: end,
          },
        },
        _sum: {
          totalAmount: true,
        },
      }),

      prisma.stockIn.findMany({
        take: 10,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
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
              payments: true,
            },
          },
        },
      }),
    ]);

    return successResponse({
      message: "Purchase overview retrieved successfully",
      data: {
        summary: {
          totalPostedDocuments,
          totalCancelledDocuments,
          totalPurchaseAmount: toNumber(
            totalPurchaseAggregate._sum.totalAmount,
          ),
          totalPaidAmount: toNumber(totalPaidAggregate._sum.paidAmount),
          totalPayableAmount: toNumber(
            totalPayableAggregate._sum.remainingAmount,
          ),
          unpaidDocuments,
          partialDocuments,
          paidDocuments,
          currentMonthDocuments,
          currentMonthPurchaseAmount: toNumber(
            currentMonthPurchaseAggregate._sum.totalAmount,
          ),
        },
        recentPurchases: recentPurchases.map((item) => ({
          id: item.id,
          documentNumber: item.documentNumber,
          invoiceNumber: item.invoiceNumber,
          stockInDate: item.stockInDate,
          dueDate: item.dueDate,
          status: item.status,
          paymentStatus: item.paymentStatus,
          totalAmount: toNumber(item.totalAmount),
          paidAmount: toNumber(item.paidAmount),
          remainingAmount: toNumber(item.remainingAmount),
          supplier: item.supplier,
          createdBy: item.createdBy,
          itemCount: item._count.items,
          paymentCount: item._count.payments,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/purchases/overview error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch purchase overview",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
