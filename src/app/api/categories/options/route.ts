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

    const categories = await prisma.category.findMany({
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
      message: "Category options retrieved successfully",
      data: categories,
    });
  } catch (error) {
    console.error("GET /api/categories/options error:", error);

    return errorResponse({
      message: "Failed to fetch category options",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
