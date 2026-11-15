import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

export async function GET() {
  try {
    const auth = await requirePermission("salesmen.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
      },
      orderBy: {
        fullName: "asc",
      },
    });

    return successResponse({
      message: "User options retrieved successfully",
      data: users,
    });
  } catch (error) {
    console.error("GET /api/users/options error:", error);

    return errorResponse({
      message: "Failed to fetch user options",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
