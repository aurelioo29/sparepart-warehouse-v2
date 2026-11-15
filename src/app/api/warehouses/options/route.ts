import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

export async function GET() {
  try {
    const auth = await requirePermission("rack_locations.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const warehouses = await prisma.warehouse.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return successResponse({
      message: "Warehouse options retrieved successfully",
      data: warehouses,
    });
  } catch (error) {
    console.error("GET /api/warehouses/options error:", error);

    return errorResponse({
      message: "Failed to fetch warehouse options",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
