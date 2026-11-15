import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

export async function GET() {
  try {
    const auth = await requirePermission("users.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const roles = await prisma.role.findMany({
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
      message: "Role options retrieved successfully",
      data: roles,
    });
  } catch (error) {
    console.error("GET /api/roles/options error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to fetch role options",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
