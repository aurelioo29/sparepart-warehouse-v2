import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("sales.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id: customerId } = await context.params;

    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!customer || !customer.isActive) {
      return errorResponse({
        message: "Customer tidak ditemukan atau sudah tidak aktif",
        status: 404,
      });
    }

    const lastSale = await prisma.sale.findFirst({
      where: {
        customerId,
        salesmanId: {
          not: null,
        },
        status: {
          not: "CANCELLED",
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        saleDate: true,
        salesman: {
          select: {
            id: true,
            code: true,
            name: true,
            salesmanType: true,
          },
        },
      },
      orderBy: [
        {
          saleDate: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    return successResponse({
      message: lastSale?.salesman
        ? "Salesman terakhir customer berhasil ditemukan"
        : "Customer belum memiliki riwayat salesman",
      data: {
        salesman: lastSale?.salesman || null,
        sourceSale: lastSale
          ? {
              id: lastSale.id,
              invoiceNumber: lastSale.invoiceNumber,
              saleDate: lastSale.saleDate,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("GET /api/customers/[id]/last-salesman error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch customer's last salesman",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
