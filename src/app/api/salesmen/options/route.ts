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

    const salesmen = await prisma.salesman.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        salesmanType: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return successResponse({
      message: "Salesman options retrieved successfully",
      data: salesmen,
    });
  } catch (error) {
    console.error("GET /api/salesmen/options error:", error);

    return errorResponse({
      message: "Failed to fetch salesman options",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
