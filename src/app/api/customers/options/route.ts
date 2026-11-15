import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

export async function GET() {
  try {
    const auth = await requirePermission("sales.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        address: true,
        customerType: true,
        paymentTermDays: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return successResponse({
      message: "Customer options retrieved successfully",
      data: customers,
    });
  } catch (error) {
    console.error("GET /api/customers/options error:", error);

    return errorResponse({
      message: "Failed to fetch customer options",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
