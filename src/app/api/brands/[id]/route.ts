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

type UpdateBrandBody = {
  name?: string;
  description?: string | null;
  isActive?: boolean;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("brands.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const brand = await prisma.brand.findUnique({
      where: {
        id,
      },
    });

    if (!brand) {
      return errorResponse({
        message: "Brand tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Brand retrieved successfully",
      data: brand,
    });
  } catch (error) {
    console.error("GET /api/brands/[id] error:", error);

    return errorResponse({
      message: "Failed to fetch brand",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("brands.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;
    const body = (await req.json()) as UpdateBrandBody;

    const oldBrand = await prisma.brand.findUnique({
      where: {
        id,
      },
    });

    if (!oldBrand) {
      return errorResponse({
        message: "Brand tidak ditemukan",
        status: 404,
      });
    }

    const name = body.name?.trim();
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? oldBrand.isActive;

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

    const duplicateBrand = await prisma.brand.findFirst({
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

    if (duplicateBrand) {
      return errorResponse({
        message: "Brand dengan nama tersebut sudah ada",
        status: 409,
      });
    }

    const updatedBrand = await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.update({
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

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "UPDATE",
          module: "brands",
          resourceType: "brands",
          resourceId: brand.id,
          oldData: oldBrand,
          newData: brand,
        },
      });

      return brand;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "brands",
      relatedId: updatedBrand.id,
      title: "Brand Updated",
      message: `${currentUser.name || "Someone"} updated brand ${
        updatedBrand.name
      }.`,
    });

    return successResponse({
      message: "Brand updated successfully",
      data: updatedBrand,
    });
  } catch (error) {
    console.error("PATCH /api/brands/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to update brand",
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
      isPermanent ? "brands.delete_permanent" : "brands.delete",
    );

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;

    const oldBrand = await prisma.brand.findUnique({
      where: {
        id,
      },
    });

    if (!oldBrand) {
      return errorResponse({
        message: "Brand tidak ditemukan",
        status: 404,
      });
    }

    if (isPermanent) {
      const deletedBrand = await prisma.$transaction(async (tx) => {
        const brand = await tx.brand.delete({
          where: {
            id,
          },
        });

        await tx.activityLog.create({
          data: {
            userId: currentUser.id,
            action: "DELETE_PERMANENT",
            module: "brands",
            resourceType: "brands",
            resourceId: brand.id,
            oldData: oldBrand,
            newData: Prisma.JsonNull,
          },
        });

        return brand;
      });

      await notifyAdmins({
        actorUserId: currentUser.id,
        eventType: "DELETE",
        module: "brands",
        relatedId: deletedBrand.id,
        title: "Brand Permanently Deleted",
        message: `${currentUser.name || "Someone"} permanently deleted brand ${
          deletedBrand.name
        }.`,
      });

      return successResponse({
        message: "Brand permanently deleted successfully",
        data: deletedBrand,
      });
    }

    if (!oldBrand.isActive) {
      return errorResponse({
        message: "Brand sudah inactive",
        status: 400,
      });
    }

    const disabledBrand = await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.update({
        where: {
          id,
        },
        data: {
          isActive: false,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "INACTIVE",
          module: "brands",
          resourceType: "brands",
          resourceId: brand.id,
          oldData: oldBrand,
          newData: brand,
        },
      });

      return brand;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "brands",
      relatedId: disabledBrand.id,
      title: "Brand Inactivated",
      message: `${currentUser.name || "Someone"} inactivated brand ${
        disabledBrand.name
      }.`,
    });

    return successResponse({
      message: "Brand inactivated successfully",
      data: disabledBrand,
    });
  } catch (error) {
    console.error("DELETE /api/brands/[id] error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return errorResponse({
        message:
          "Brand tidak bisa dihapus permanent karena masih digunakan oleh data lain. Gunakan inactive saja.",
        status: 409,
        errors: error.message,
      });
    }

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to delete brand",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
