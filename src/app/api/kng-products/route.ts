import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type CreateKngProductBody = {
  jenis?: string;
  partNumber?: string;
  hargaJkt?: number | string;
  isActive?: boolean;
};

function getKngProductOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.KngProductOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "jenis":
      return { jenis: order };

    case "partNumber":
      return { partNumber: order };

    case "hargaJkt":
      return { hargaJkt: order };

    case "isActive":
      return { isActive: order };

    case "updatedAt":
      return { updatedAt: order };

    case "createdAt":
    default:
      return { createdAt: order };
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("kng-products.view");

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
    const jenis = (searchParams.get("jenis") || "").trim();
    const isActive = (searchParams.get("isActive") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const skip = (page - 1) * limit;

    const where: Prisma.KngProductWhereInput = {};

    if (search) {
      where.OR = [
        {
          jenis: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          partNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (jenis) {
      where.jenis = {
        contains: jenis,
        mode: "insensitive",
      };
    }

    if (isActive === "true") {
      where.isActive = true;
    }

    if (isActive === "false") {
      where.isActive = false;
    }

    const [items, total] = await prisma.$transaction([
      prisma.kngProduct.findMany({
        where,
        orderBy: getKngProductOrderBy(sortBy, sortOrder),
        skip,
        take: limit,
      }),

      prisma.kngProduct.count({
        where,
      }),
    ]);

    return successResponse({
      message: "KNG products retrieved successfully",
      data: {
        items,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/kng-products error:", error);

    return errorResponse({
      message: "Failed to fetch KNG products",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("kng-products.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const body = (await req.json()) as CreateKngProductBody;

    const jenis = body.jenis?.trim();
    const partNumber = body.partNumber?.trim();
    const hargaJkt = Number(body.hargaJkt ?? 0);
    const isActive = body.isActive ?? true;

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

    const existingProduct = await prisma.kngProduct.findFirst({
      where: {
        jenis,
        partNumber,
      },
      select: {
        id: true,
      },
    });

    if (existingProduct) {
      return errorResponse({
        message: "Product KNG dengan jenis dan part number tersebut sudah ada",
        status: 409,
      });
    }

    const product = await prisma.kngProduct.create({
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
        action: "CREATE",
        module: "kng-products",
        resourceType: "kng-products",
        resourceId: product.id,
        oldData: Prisma.JsonNull,
        newData: product,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "CREATE",
      module: "kng-products",
      relatedId: product.id,
      title: "KNG Product Created",
      message: `${auth.user.name || "Someone"} created KNG product ${
        product.partNumber
      }.`,
    });

    return successResponse({
      message: "KNG product created successfully",
      data: product,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/kng-products error:", error);

    return errorResponse({
      message: "Failed to create KNG product",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
