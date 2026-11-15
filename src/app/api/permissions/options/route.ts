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

    const permissions = await prisma.permission.findMany({
      select: {
        id: true,
        name: true,
        key: true,
        module: true,
      },
      orderBy: [
        {
          module: "asc",
        },
        {
          key: "asc",
        },
      ],
    });

    return successResponse({
      message: "Permission options retrieved successfully",
      data: permissions,
    });
  } catch (error) {
    console.error("GET /api/permissions/options error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch permission options",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
