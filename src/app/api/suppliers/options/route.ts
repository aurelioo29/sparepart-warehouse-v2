import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

export async function GET() {
  try {
    const auth = await requirePermission("products.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const suppliers = await prisma.supplier.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return successResponse({
      message: "Supplier options retrieved successfully",
      data: suppliers,
    });
  } catch (error) {
    console.error("GET /api/suppliers/options error:", error);

    return errorResponse({
      message: "Failed to fetch supplier options",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
