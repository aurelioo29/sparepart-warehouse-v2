import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";
import { slugify } from "@/lib/slug";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateCategoryBody = {
  name?: string;
  description?: string | null;
  isActive?: boolean;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("categories.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const category = await prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!category) {
      return errorResponse({
        message: "Category tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Category retrieved successfully",
      data: category,
    });
  } catch (error) {
    console.error("GET /api/categories/[id] error:", error);

    return errorResponse({
      message: "Failed to fetch category",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("categories.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;
    const body = (await req.json()) as UpdateCategoryBody;

    const oldCategory = await prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!oldCategory) {
      return errorResponse({
        message: "Category tidak ditemukan",
        status: 404,
      });
    }

    const name = body.name?.trim();
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? oldCategory.isActive;

    if (!name) {
      return errorResponse({
        message: "Name is required",
        status: 400,
      });
    }

    const slug = slugify(name);

    if (!slug) {
      return errorResponse({
        message: "Name tidak valid untuk dibuat slug",
        status: 400,
      });
    }

    const duplicateCategory = await prisma.category.findFirst({
      where: {
        id: {
          not: id,
        },
        slug,
      },
      select: {
        id: true,
      },
    });

    if (duplicateCategory) {
      return errorResponse({
        message: "Category dengan nama tersebut sudah ada",
        status: 409,
      });
    }

    const updatedCategory = await prisma.category.update({
      where: {
        id,
      },
      data: {
        name,
        slug,
        description,
        isActive,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "UPDATE",
        module: "categories",
        resourceType: "categories",
        resourceId: updatedCategory.id,
        oldData: oldCategory,
        newData: updatedCategory,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "UPDATE",
      module: "categories",
      relatedId: updatedCategory.id,
      title: "Category Updated",
      message: `${auth.user.name || "Someone"} updated category ${
        updatedCategory.name
      }.`,
    });

    return successResponse({
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    console.error("PATCH /api/categories/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to update category",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { searchParams } = new URL(req.url);
    const isPermanent = searchParams.get("permanent") === "true";

    const auth = await requirePermission(
      isPermanent ? "categories.delete_permanent" : "categories.delete",
    );

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const oldCategory = await prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!oldCategory) {
      return errorResponse({
        message: "Category tidak ditemukan",
        status: 404,
      });
    }

    if (isPermanent) {
      const deletedCategory = await prisma.category.delete({
        where: {
          id,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: auth.user.id,
          action: "DELETE_PERMANENT",
          module: "categories",
          resourceType: "categories",
          resourceId: deletedCategory.id,
          oldData: oldCategory,
          newData: Prisma.JsonNull,
        },
      });

      await notifyAdmins({
        actorUserId: auth.user.id,
        eventType: "DELETE",
        module: "categories",
        relatedId: deletedCategory.id,
        title: "Category Permanently Deleted",
        message: `${auth.user.name || "Someone"} permanently deleted category ${
          deletedCategory.name
        }.`,
      });

      return successResponse({
        message: "Category permanently deleted successfully",
        data: deletedCategory,
      });
    }

    if (!oldCategory.isActive) {
      return errorResponse({
        message: "Category sudah inactive",
        status: 400,
      });
    }

    const disabledCategory = await prisma.category.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "INACTIVE",
        module: "categories",
        resourceType: "categories",
        resourceId: disabledCategory.id,
        oldData: oldCategory,
        newData: disabledCategory,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "UPDATE",
      module: "categories",
      relatedId: disabledCategory.id,
      title: "Category Inactivated",
      message: `${auth.user.name || "Someone"} inactivated category ${
        disabledCategory.name
      }.`,
    });

    return successResponse({
      message: "Category inactivated successfully",
      data: disabledCategory,
    });
  } catch (error) {
    console.error("DELETE /api/categories/[id] error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return errorResponse({
        message:
          "Category tidak bisa dihapus permanent karena masih digunakan oleh data lain. Gunakan inactive saja.",
        status: 409,
        errors: error.message,
      });
    }

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to delete category",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
