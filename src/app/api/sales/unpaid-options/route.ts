import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

export async function GET() {
  try {
    const auth = await requirePermission("sale_payments.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const sales = await prisma.sale.findMany({
      where: {
        status: "POSTED",
        paymentStatus: {
          in: ["UNPAID", "PARTIAL"],
        },
        remainingAmount: {
          gt: 0,
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        saleDate: true,
        totalAmount: true,
        paidAmount: true,
        remainingAmount: true,
        paymentStatus: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        saleDate: "desc",
      },
    });

    return successResponse({
      message: "Unpaid sale options retrieved successfully",
      data: sales,
    });
  } catch (error) {
    console.error("GET /api/sales/unpaid-options error:", error);

    return errorResponse({
      message: "Failed to fetch unpaid sales",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
