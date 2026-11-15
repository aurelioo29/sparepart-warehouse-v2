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

type UpdateProductBody = {
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string;
  supplierId?: string | null;
  warehouseId?: string | null;
  rackLocationId?: string | null;

  sku?: string;
  barcode?: string | null;
  name?: string;

  purchasePrice?: number | string | null;
  sellingPrice?: number | string | null;

  minStock?: number | string | null;

  imageUrl?: string | null;
  description?: string | null;
  isActive?: boolean;
};

function parseDecimal(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    throw new Error("Price harus berupa angka");
  }

  return numberValue;
}

function parseInteger(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue)) {
    throw new Error("Stock harus berupa angka bulat");
  }

  return numberValue;
}

function nullableId(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : null;
}

const productInclude = {
  category: true,
  brand: true,
  unit: true,
  supplier: true,
  warehouse: true,
  rackLocation: true,
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("products.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const product = await prisma.product.findUnique({
      where: {
        id,
      },
      include: productInclude,
    });

    if (!product) {
      return errorResponse({
        message: "Product tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Product retrieved successfully",
      data: product,
    });
  } catch (error) {
    console.error("GET /api/products/[id] error:", error);

    return errorResponse({
      message: "Failed to fetch product",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("products.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;
    const body = (await req.json()) as UpdateProductBody;

    const oldProduct = await prisma.product.findUnique({
      where: {
        id,
      },
      include: productInclude,
    });

    if (!oldProduct) {
      return errorResponse({
        message: "Product tidak ditemukan",
        status: 404,
      });
    }

    const categoryId = nullableId(body.categoryId);
    const brandId = nullableId(body.brandId);
    const unitId = body.unitId?.trim();
    const supplierId = nullableId(body.supplierId);
    const warehouseId = nullableId(body.warehouseId);
    const rackLocationId = nullableId(body.rackLocationId);

    const sku = body.sku?.trim().toUpperCase();
    const barcode = body.barcode?.trim() || null;
    const name = body.name?.trim();

    const purchasePrice = parseDecimal(body.purchasePrice, 0);
    const sellingPrice = parseDecimal(body.sellingPrice, 0);
    const minStock = parseInteger(body.minStock, 0);

    const imageUrl = body.imageUrl?.trim() || null;
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? oldProduct.isActive;

    if (!sku || !name || !unitId) {
      return errorResponse({
        message: "SKU, name, and unit are required",
        status: 400,
      });
    }

    const slug = slugify(`${sku}-${name}`);

    if (!slug) {
      return errorResponse({
        message: "Name tidak valid untuk dibuat slug",
        status: 400,
      });
    }

    const duplicateSku = await prisma.product.findFirst({
      where: {
        id: {
          not: id,
        },
        sku,
      },
      select: {
        id: true,
      },
    });

    if (duplicateSku) {
      return errorResponse({
        message: "SKU sudah digunakan",
        status: 409,
      });
    }

    if (barcode) {
      const duplicateBarcode = await prisma.product.findFirst({
        where: {
          id: {
            not: id,
          },
          barcode,
        },
        select: {
          id: true,
        },
      });

      if (duplicateBarcode) {
        return errorResponse({
          message: "Barcode sudah digunakan",
          status: 409,
        });
      }
    }

    const duplicateSlug = await prisma.product.findFirst({
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

    if (duplicateSlug) {
      return errorResponse({
        message: "Product dengan SKU dan nama tersebut sudah ada",
        status: 409,
      });
    }

    const unit = await prisma.unit.findUnique({
      where: {
        id: unitId,
      },
      select: {
        id: true,
      },
    });

    if (!unit) {
      return errorResponse({
        message: "Unit tidak ditemukan",
        status: 404,
      });
    }

    if (rackLocationId && warehouseId) {
      const rackLocation = await prisma.rackLocation.findFirst({
        where: {
          id: rackLocationId,
          warehouseId,
        },
        select: {
          id: true,
        },
      });

      if (!rackLocation) {
        return errorResponse({
          message: "Rack location tidak sesuai dengan warehouse",
          status: 400,
        });
      }
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: {
          id,
        },
        data: {
          categoryId,
          brandId,
          unitId,
          supplierId,
          warehouseId,
          rackLocationId,

          sku,
          barcode,
          name,
          slug,

          purchasePrice,
          sellingPrice,
          minStock,

          imageUrl,
          description,
          isActive,
        },
        include: productInclude,
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "UPDATE",
          module: "products",
          resourceType: "products",
          resourceId: product.id,
          oldData: oldProduct,
          newData: product,
        },
      });

      return product;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "products",
      relatedId: updatedProduct.id,
      title: "Product Updated",
      message: `${currentUser.name || "Someone"} updated product ${
        updatedProduct.name
      }.`,
    });

    return successResponse({
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("PATCH /api/products/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to update product",
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
      isPermanent ? "products.delete_permanent" : "products.delete",
    );

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;

    const oldProduct = await prisma.product.findUnique({
      where: {
        id,
      },
      include: productInclude,
    });

    if (!oldProduct) {
      return errorResponse({
        message: "Product tidak ditemukan",
        status: 404,
      });
    }

    if (isPermanent) {
      const deletedProduct = await prisma.$transaction(async (tx) => {
        const product = await tx.product.delete({
          where: {
            id,
          },
          include: productInclude,
        });

        await tx.activityLog.create({
          data: {
            userId: currentUser.id,
            action: "DELETE_PERMANENT",
            module: "products",
            resourceType: "products",
            resourceId: product.id,
            oldData: oldProduct,
            newData: Prisma.JsonNull,
          },
        });

        return product;
      });

      await notifyAdmins({
        actorUserId: currentUser.id,
        eventType: "DELETE",
        module: "products",
        relatedId: deletedProduct.id,
        title: "Product Permanently Deleted",
        message: `${currentUser.name || "Someone"} permanently deleted product ${
          deletedProduct.name
        }.`,
      });

      return successResponse({
        message: "Product permanently deleted successfully",
        data: deletedProduct,
      });
    }

    if (!oldProduct.isActive) {
      return errorResponse({
        message: "Product sudah inactive",
        status: 400,
      });
    }

    const disabledProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: {
          id,
        },
        data: {
          isActive: false,
        },
        include: productInclude,
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "INACTIVE",
          module: "products",
          resourceType: "products",
          resourceId: product.id,
          oldData: oldProduct,
          newData: product,
        },
      });

      return product;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "products",
      relatedId: disabledProduct.id,
      title: "Product Inactivated",
      message: `${currentUser.name || "Someone"} inactivated product ${
        disabledProduct.name
      }.`,
    });

    return successResponse({
      message: "Product inactivated successfully",
      data: disabledProduct,
    });
  } catch (error) {
    console.error("DELETE /api/products/[id] error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return errorResponse({
        message:
          "Product tidak bisa dihapus permanent karena masih digunakan oleh transaksi atau data stok. Gunakan inactive saja.",
        status: 409,
        errors: error.message,
      });
    }

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to delete product",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
