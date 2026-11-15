import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("users.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const role = await prisma.role.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        slug: true,

        rolePermissions: {
          select: {
            permission: {
              select: {
                id: true,
                name: true,
                key: true,
                module: true,
              },
            },
          },
          orderBy: {
            permission: {
              key: "asc",
            },
          },
        },
      },
    });

    if (!role) {
      return errorResponse({
        message: "Role tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Role permissions retrieved successfully",
      data: {
        role: {
          id: role.id,
          name: role.name,
          slug: role.slug,
        },

        permissions: role.rolePermissions.map((item) => item.permission),
      },
    });
  } catch (error) {
    console.error("GET /api/roles/[id]/permissions error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch role permissions",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
