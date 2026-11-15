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
    const auth = await requirePermission("roles.view");

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

    const limit =
      Number.isNaN(limitValue) || limitValue < 1
        ? 10
        : Math.min(limitValue, 100);

    const skip = (page - 1) * limit;

    const role = await prisma.role.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
      },
    });

    if (!role) {
      return errorResponse({
        message: "Role tidak ditemukan",
        status: 404,
      });
    }

    const where = {
      module: "roles",
      resourceType: "roles",
      resourceId: id,
    };

    const [items, total] = await prisma.$transaction([
      prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
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
      message: "Role changelogs retrieved successfully",
      data: {
        role,
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
    console.error("GET /api/roles/[id]/changelogs error:", error);

    return errorResponse({
      message: "Failed to fetch role changelogs",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
