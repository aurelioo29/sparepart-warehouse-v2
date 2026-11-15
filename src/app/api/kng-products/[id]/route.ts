import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateKngProductBody = {
  jenis?: string;
  partNumber?: string;
  hargaJkt?: number | string;
  isActive?: boolean;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("kng-products.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const product = await prisma.kngProduct.findUnique({
      where: {
        id,
      },
    });

    if (!product) {
      return errorResponse({
        message: "KNG product tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "KNG product retrieved successfully",
      data: product,
    });
  } catch (error) {
    console.error("GET /api/kng-products/[id] error:", error);

    return errorResponse({
      message: "Failed to fetch KNG product",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("kng-products.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;
    const body = (await req.json()) as UpdateKngProductBody;

    const oldProduct = await prisma.kngProduct.findUnique({
      where: {
        id,
      },
    });

    if (!oldProduct) {
      return errorResponse({
        message: "KNG product tidak ditemukan",
        status: 404,
      });
    }

    const jenis = body.jenis?.trim();
    const partNumber = body.partNumber?.trim();
    const hargaJkt = Number(body.hargaJkt ?? oldProduct.hargaJkt);
    const isActive = body.isActive ?? oldProduct.isActive;

    if (!jenis) {
      return errorResponse({
        message: "Jenis is required",
        status: 400,
      });
    }

    if (!partNumber) {
      return errorResponse({
        message: "Part number is required",
        status: 400,
      });
    }

    if (Number.isNaN(hargaJkt) || hargaJkt < 0) {
      return errorResponse({
        message: "Harga JKT tidak valid",
        status: 400,
      });
    }

    const duplicateProduct = await prisma.kngProduct.findFirst({
      where: {
        id: {
          not: id,
        },
        jenis,
        partNumber,
      },
      select: {
        id: true,
      },
    });

    if (duplicateProduct) {
      return errorResponse({
        message: "Product KNG dengan jenis dan part number tersebut sudah ada",
        status: 409,
      });
    }

    const updatedProduct = await prisma.kngProduct.update({
      where: {
        id,
      },
      data: {
        jenis,
        partNumber,
        hargaJkt,
        isActive,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "UPDATE",
        module: "kng-products",
        resourceType: "kng-products",
        resourceId: updatedProduct.id,
        oldData: oldProduct,
        newData: updatedProduct,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "UPDATE",
      module: "kng-products",
      relatedId: updatedProduct.id,
      title: "KNG Product Updated",
      message: `${auth.user.name || "Someone"} updated KNG product ${
        updatedProduct.partNumber
      }.`,
    });

    return successResponse({
      message: "KNG product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("PATCH /api/kng-products/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to update KNG product",
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
      isPermanent ? "kng-products.delete_permanent" : "kng-products.delete",
    );

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const oldProduct = await prisma.kngProduct.findUnique({
      where: {
        id,
      },
    });

    if (!oldProduct) {
      return errorResponse({
        message: "KNG product tidak ditemukan",
        status: 404,
      });
    }

    if (isPermanent) {
      const deletedProduct = await prisma.kngProduct.delete({
        where: {
          id,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: auth.user.id,
          action: "DELETE_PERMANENT",
          module: "kng-products",
          resourceType: "kng-products",
          resourceId: deletedProduct.id,
          oldData: oldProduct,
          newData: Prisma.JsonNull,
        },
      });

      await notifyAdmins({
        actorUserId: auth.user.id,
        eventType: "DELETE",
        module: "kng-products",
        relatedId: deletedProduct.id,
        title: "KNG Product Permanently Deleted",
        message: `${auth.user.name || "Someone"} permanently deleted KNG product ${
          deletedProduct.partNumber
        }.`,
      });

      return successResponse({
        message: "KNG product permanently deleted successfully",
        data: deletedProduct,
      });
    }

    if (!oldProduct.isActive) {
      return errorResponse({
        message: "KNG product sudah inactive",
        status: 400,
      });
    }

    const disabledProduct = await prisma.kngProduct.update({
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
        module: "kng-products",
        resourceType: "kng-products",
        resourceId: disabledProduct.id,
        oldData: oldProduct,
        newData: disabledProduct,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "UPDATE",
      module: "kng-products",
      relatedId: disabledProduct.id,
      title: "KNG Product Inactivated",
      message: `${auth.user.name || "Someone"} inactivated KNG product ${
        disabledProduct.partNumber
      }.`,
    });

    return successResponse({
      message: "KNG product inactivated successfully",
      data: disabledProduct,
    });
  } catch (error) {
    console.error("DELETE /api/kng-products/[id] error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return errorResponse({
        message:
          "KNG product tidak bisa dihapus permanent karena masih digunakan oleh order. Gunakan inactive saja.",
        status: 409,
        errors: error.message,
      });
    }

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to delete KNG product",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
