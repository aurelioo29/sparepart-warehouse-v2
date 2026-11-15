import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";
import { slugify } from "@/lib/slug";

type CreateProductBody = {
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

function getProductOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.ProductOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "sku":
      return { sku: order };

    case "barcode":
      return { barcode: order };

    case "name":
      return { name: order };

    case "category":
      return {
        category: {
          name: order,
        },
      };

    case "brand":
      return {
        brand: {
          name: order,
        },
      };

    case "unit":
      return {
        unit: {
          name: order,
        },
      };

    case "purchasePrice":
      return { purchasePrice: order };

    case "sellingPrice":
      return { sellingPrice: order };

    case "currentStock":
      return { currentStock: order };

    case "minStock":
      return { minStock: order };

    case "isActive":
      return { isActive: order };

    case "updatedAt":
      return { updatedAt: order };

    case "createdAt":
    default:
      return { createdAt: order };
  }
}

function parseDecimal(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    throw new Error("Price harus berupa angka");
  }

  return numberValue;
}

function parseInteger(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

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

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("products.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);

    const search = (searchParams.get("search") || "").trim();
    const categoryId = (searchParams.get("categoryId") || "").trim();
    const brandId = (searchParams.get("brandId") || "").trim();
    const unitId = (searchParams.get("unitId") || "").trim();
    const supplierId = (searchParams.get("supplierId") || "").trim();
    const warehouseId = (searchParams.get("warehouseId") || "").trim();
    const rackLocationId = (searchParams.get("rackLocationId") || "").trim();
    const stockStatus = (searchParams.get("stockStatus") || "").trim();
    const isActive = (searchParams.get("isActive") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = Number.isNaN(limit) || limit < 1 ? 10 : limit;
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.ProductWhereInput = {};

    if (search) {
      where.OR = [
        {
          sku: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          barcode: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          category: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          brand: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (brandId) {
      where.brandId = brandId;
    }

    if (unitId) {
      where.unitId = unitId;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (rackLocationId) {
      where.rackLocationId = rackLocationId;
    }

    if (isActive === "true") {
      where.isActive = true;
    }

    if (isActive === "false") {
      where.isActive = false;
    }

    if (stockStatus === "OUT_OF_STOCK") {
      where.currentStock = 0;
    }

    /**
     * Catatan:
     * LOW_STOCK jangan pakai:
     *
     * where.currentStock = {
     *   lte: prisma.product.fields.minStock,
     * }
     *
     * Karena di beberapa setup Prisma generated client, field reference ini bisa bikin API 500.
     * Nanti low stock lebih aman kita buat di endpoint report khusus atau raw query.
     */

    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
            },
          },
          unit: {
            select: {
              id: true,
              name: true,
              shortName: true,
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          rackLocation: {
            select: {
              id: true,
              name: true,
              code: true,
              warehouseId: true,
            },
          },
        },
        orderBy: getProductOrderBy(sortBy, sortOrder),
        skip,
        take: safeLimit,
      }),

      prisma.product.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Products retrieved successfully",
      data: {
        items,
        meta: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/products error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to fetch products",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("products.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const body = (await req.json()) as CreateProductBody;

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
    const isActive = body.isActive ?? true;

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

    const duplicateSku = await prisma.product.findUnique({
      where: {
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
      const duplicateBarcode = await prisma.product.findUnique({
        where: {
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

    const duplicateSlug = await prisma.product.findUnique({
      where: {
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

    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: {
          id: categoryId,
        },
        select: {
          id: true,
        },
      });

      if (!category) {
        return errorResponse({
          message: "Category tidak ditemukan",
          status: 404,
        });
      }
    }

    if (brandId) {
      const brand = await prisma.brand.findUnique({
        where: {
          id: brandId,
        },
        select: {
          id: true,
        },
      });

      if (!brand) {
        return errorResponse({
          message: "Brand tidak ditemukan",
          status: 404,
        });
      }
    }

    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: {
          id: supplierId,
        },
        select: {
          id: true,
        },
      });

      if (!supplier) {
        return errorResponse({
          message: "Supplier tidak ditemukan",
          status: 404,
        });
      }
    }

    if (warehouseId) {
      const warehouse = await prisma.warehouse.findUnique({
        where: {
          id: warehouseId,
        },
        select: {
          id: true,
        },
      });

      if (!warehouse) {
        return errorResponse({
          message: "Warehouse tidak ditemukan",
          status: 404,
        });
      }
    }

    if (rackLocationId) {
      const rackLocation = await prisma.rackLocation.findUnique({
        where: {
          id: rackLocationId,
        },
        select: {
          id: true,
          warehouseId: true,
        },
      });

      if (!rackLocation) {
        return errorResponse({
          message: "Rack location tidak ditemukan",
          status: 404,
        });
      }

      if (warehouseId && rackLocation.warehouseId !== warehouseId) {
        return errorResponse({
          message: "Rack location tidak sesuai dengan warehouse",
          status: 400,
        });
      }
    }

    const product = await prisma.product.create({
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
        currentStock: 0,
        minStock,

        imageUrl,
        description,
        isActive,
      },
      include: {
        category: true,
        brand: true,
        unit: true,
        supplier: true,
        warehouse: true,
        rackLocation: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "CREATE",
        module: "products",
        resourceType: "products",
        resourceId: product.id,
        oldData: Prisma.JsonNull,
        newData: product,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "CREATE",
      module: "products",
      relatedId: product.id,
      title: "Product Created",
      message: `${auth.user.name || "Someone"} created product ${
        product.name
      }.`,
    });

    return successResponse({
      message: "Product created successfully",
      data: product,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/products error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to create product",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
