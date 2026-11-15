import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("purchase_payments.view");

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

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = Number.isNaN(limit) || limit < 1 ? 10 : limit;
    const skip = (safePage - 1) * safeLimit;

    const payment = await prisma.purchasePayment.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        paymentDate: true,
        amount: true,
        method: true,
        referenceNumber: true,
        attachments: {
          select: {
            id: true,
            fileName: true,
            originalName: true,
            mimeType: true,
            size: true,
            fileUrl: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        stockIn: {
          select: {
            id: true,
            documentNumber: true,
            invoiceNumber: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!payment) {
      return errorResponse({
        message: "Purchase payment tidak ditemukan",
        status: 404,
      });
    }

    const where = {
      module: "purchase_payments",
      resourceType: "purchase_payments",
      resourceId: id,
    };

    const [items, total] = await prisma.$transaction([
      prisma.activityLog.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: safeLimit,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
            },
          },
        },
      }),

      prisma.activityLog.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Purchase payment changelogs retrieved successfully",
      data: {
        payment,
        items,
        meta: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/purchase-payments/[id]/changelogs error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch purchase payment changelogs",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
