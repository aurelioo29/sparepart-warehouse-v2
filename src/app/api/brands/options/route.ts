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

    const brands = await prisma.brand.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return successResponse({
      message: "Brand options retrieved successfully",
      data: brands,
    });
  } catch (error) {
    console.error("GET /api/brands/options error:", error);

    return errorResponse({
      message: "Failed to fetch brand options",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}