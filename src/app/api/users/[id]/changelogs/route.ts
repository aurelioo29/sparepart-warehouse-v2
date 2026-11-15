import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("users.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);

    const pageValue = Number(searchParams.get("page") || 1);

    const limitValue = Number(searchParams.get("limit") || 10);

    const page = Number.isNaN(pageValue) || pageValue < 1 ? 1 : pageValue;

    /**
     * Maksimal 100 data per request.
     */
    const limit =
      Number.isNaN(limitValue) || limitValue < 1
        ? 10
        : Math.min(limitValue, 100);

    const skip = (page - 1) * limit;

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        isActive: true,

        role: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!user) {
      return errorResponse({
        message: "User tidak ditemukan",
        status: 404,
      });
    }

    /**
     * Harus sama dengan data activityLog
     * yang dibuat pada POST, PATCH, dan DELETE user.
     */
    const where = {
      module: "users",
      resourceType: "users",
      resourceId: id,
    };

    const [items, total] = await prisma.$transaction([
      prisma.activityLog.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,

        select: {
          id: true,
          action: true,
          module: true,
          resourceType: true,
          resourceId: true,
          oldData: true,
          newData: true,
          createdAt: true,

          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
            },
          },
        },
      }),

      prisma.activityLog.count({
        where,
      }),
    ]);

    return successResponse({
      message: "User changelogs retrieved successfully",
      data: {
        user,
        items,

        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/users/[id]/changelogs error:", error);

    return errorResponse({
      message: "Failed to fetch user changelogs",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
