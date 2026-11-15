import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";
import {
  calculateHargaNetto,
  generateKngOrderNumber,
  isKngOrderStatus,
  parseKngOrderDate,
  toJson,
} from "@/lib/kng-orders";

type CreateKngOrderBody = {
  orderDate?: string;
  discountPercent?: number | string;
  noteFranco?: string | null;
  noteTop?: string | null;
  notes?: string | null;
  items?: {
    kngProductId?: string;
    quantity?: number | string;
    hargaNetto?: number | string;
  }[];
};

function getKngOrderOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.KngOrderOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "orderNumber":
      return { orderNumber: order };

    case "orderDate":
      return { orderDate: order };

    case "totalQty":
      return { totalQty: order };

    case "totalAmount":
      return { totalAmount: order };

    case "status":
      return { status: order };

    case "updatedAt":
      return { updatedAt: order };

    case "createdAt":
    default:
      return { createdAt: order };
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("kng-orders.view");

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
    const status = (searchParams.get("status") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const skip = (page - 1) * limit;

    const where: Prisma.KngOrderWhereInput = {};

    if (search) {
      where.OR = [
        {
          orderNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          noteFranco: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          noteTop: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          notes: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          items: {
            some: {
              jenisSnapshot: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          items: {
            some: {
              partNumberSnapshot: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    if (status) {
      if (!isKngOrderStatus(status)) {
        return errorResponse({
          message: "Status order tidak valid",
          status: 400,
        });
      }

      where.status = status as Prisma.KngOrderWhereInput["status"];
    }

    if (dateFrom || dateTo) {
      where.orderDate = {};

      if (dateFrom) {
        where.orderDate.gte = parseKngOrderDate(dateFrom);
      }

      if (dateTo) {
        where.orderDate.lte = parseKngOrderDate(dateTo);
      }
    }

    const [items, total] = await prisma.$transaction([
      prisma.kngOrder.findMany({
        where,
        orderBy: getKngOrderOrderBy(sortBy, sortOrder),
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              items: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
            },
          },
        },
      }),

      prisma.kngOrder.count({
        where,
      }),
    ]);

    return successResponse({
      message: "KNG orders retrieved successfully",
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
    console.error("GET /api/kng-orders error:", error);

    return errorResponse({
      message: "Failed to fetch KNG orders",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("kng-orders.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const user = auth.user;
    const body = (await req.json()) as CreateKngOrderBody;

    const orderDate = parseKngOrderDate(body.orderDate);
    const discountPercent = Number(body.discountPercent ?? 30);

    const noteFranco = body.noteFranco?.trim() || "Frangko Medan";
    const noteTop = body.noteTop?.trim() || "Top = 125 hari";
    const notes = body.notes?.trim() || null;

    if (
      Number.isNaN(discountPercent) ||
      discountPercent < 0 ||
      discountPercent > 100
    ) {
      return errorResponse({
        message: "Diskon tidak valid",
        status: 400,
      });
    }

    if (!body.items || body.items.length === 0) {
      return errorResponse({
        message: "Minimal 1 product wajib ditambahkan",
        status: 400,
      });
    }

    const normalizedItems = body.items.map((item) => ({
      kngProductId: item.kngProductId?.trim() || "",
      quantity: Number(item.quantity || 0),
      hargaNetto: Number(item.hargaNetto || 0),
    }));

    const invalidItem = normalizedItems.find((item) => {
      return (
        !item.kngProductId ||
        Number.isNaN(item.quantity) ||
        item.quantity <= 0 ||
        Number.isNaN(item.hargaNetto) ||
        item.hargaNetto < 0
      );
    });

    if (invalidItem) {
      return errorResponse({
        message: "Product, order/pc, dan harga netto wajib diisi dengan benar",
        status: 400,
      });
    }

    const productIds = normalizedItems.map((item) => item.kngProductId);
    const uniqueProductIds = Array.from(new Set(productIds));

    const products = await prisma.kngProduct.findMany({
      where: {
        id: {
          in: uniqueProductIds,
        },
        isActive: true,
      },
    });

    if (products.length !== uniqueProductIds.length) {
      return errorResponse({
        message: "Ada product KNG yang tidak ditemukan atau tidak aktif",
        status: 400,
      });
    }

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    const createdOrder = await prisma.$transaction(async (tx) => {
      const orderNumber = await generateKngOrderNumber(tx, orderDate);

      const orderItems = normalizedItems.map((item) => {
        const product = productMap.get(item.kngProductId);

        if (!product) {
          throw new Error("Product KNG tidak ditemukan");
        }

        const hargaJkt = Number(product.hargaJkt);
        const defaultHargaNetto = calculateHargaNetto(
          hargaJkt,
          discountPercent,
        );

        const hargaNetto =
          item.hargaNetto > 0 ? item.hargaNetto : defaultHargaNetto;

        const totalAmount = hargaNetto * item.quantity;

        return {
          product,
          quantity: item.quantity,
          hargaJkt,
          hargaNetto,
          totalAmount,
        };
      });

      const totalQty = orderItems.reduce((sum, item) => {
        return sum + item.quantity;
      }, 0);

      const totalAmount = orderItems.reduce((sum, item) => {
        return sum + item.totalAmount;
      }, 0);

      const order = await tx.kngOrder.create({
        data: {
          orderNumber,
          orderDate,
          discountPercent,
          totalQty,
          totalAmount,
          status: "POSTED",
          noteFranco,
          noteTop,
          notes,
          createdById: user.id,
          postedAt: new Date(),
          items: {
            create: orderItems.map((item) => ({
              kngProductId: item.product.id,
              jenisSnapshot: item.product.jenis,
              partNumberSnapshot: item.product.partNumber,
              hargaJkt: item.hargaJkt,
              hargaNetto: item.hargaNetto,
              quantity: item.quantity,
              totalAmount: item.totalAmount,
            })),
          },
        },
        include: {
          items: {
            orderBy: {
              createdAt: "asc",
            },
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
            },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "CREATE",
          module: "kng-orders",
          resourceType: "kng-orders",
          resourceId: order.id,
          oldData: Prisma.JsonNull,
          newData: toJson(order),
        },
      });

      return order;
    });

    await notifyAdmins({
      actorUserId: user.id,
      eventType: "CREATE",
      module: "kng-orders",
      relatedId: createdOrder.id,
      title: "KNG Order Created",
      message: `${user.name || "Someone"} created KNG order ${
        createdOrder.orderNumber
      }.`,
    });

    return successResponse({
      message: "KNG order created successfully",
      data: createdOrder,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/kng-orders error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return errorResponse({
        message: "Nomor order bentrok. Coba submit ulang.",
        status: 409,
        errors: error.message,
      });
    }

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to create KNG order",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
