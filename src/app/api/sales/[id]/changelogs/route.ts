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
    const auth = await requirePermission("sales.view");

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
    const skip = (page - 1) * limit;

    const sale = await prisma.sale.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        invoiceNumber: true,
        saleDate: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!sale) {
      return errorResponse({
        message: "Sale tidak ditemukan",
        status: 404,
      });
    }

    const where = {
      module: "sales",
      resourceType: "sales",
      resourceId: id,
    };

    const [items, total] = await prisma.$transaction([
      prisma.activityLog.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
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
      message: "Sale changelogs retrieved successfully",
      data: {
        sale,
        items,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/sales/[id]/changelogs error:", error);

    return errorResponse({
      message: "Failed to fetch sale changelogs",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
