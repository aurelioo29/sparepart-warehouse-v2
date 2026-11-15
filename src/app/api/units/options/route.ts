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

    const units = await prisma.unit.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        shortName: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return successResponse({
      message: "Unit options retrieved successfully",
      data: units,
    });
  } catch (error) {
    console.error("GET /api/units/options error:", error);

    return errorResponse({
      message: "Failed to fetch unit options",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
