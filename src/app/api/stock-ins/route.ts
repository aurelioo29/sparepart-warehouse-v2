import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type StockInItemBody = {
  productId?: string;
  warehouseId?: string | null;
  rackLocationId?: string | null;
  quantity?: number | string;
  unitPrice?: number | string | null;
};

type CreateStockInBody = {
  supplierId?: string | null;
  documentNumber?: string | null;
  invoiceNumber?: string | null;
  stockInDate?: string | null;
  notes?: string | null;
  items?: StockInItemBody[];
};

const stockInStatuses = ["DRAFT", "POSTED", "CANCELLED"] as const;

type StockInStatusValue = (typeof stockInStatuses)[number];

function isStockInStatus(value: string): value is StockInStatusValue {
  return stockInStatuses.includes(value as StockInStatusValue);
}

function parseDate(value: unknown) {
  if (!value) {
    return new Date();
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal barang masuk tidak valid");
  }

  return date;
}

function parseInteger(value: unknown, fieldName: string) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${fieldName} harus berupa angka bulat lebih dari 0`);
  }

  return numberValue;
}

function parseDecimal(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue) || numberValue < 0) {
    throw new Error("Harga harus berupa angka minimal 0");
  }

  return numberValue;
}

function nullableId(value: string | null | undefined) {
  const clean = value?.trim();

  return clean ? clean : null;
}

function nullableText(value: string | null | undefined) {
  const clean = value?.trim();

  return clean ? clean : null;
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value || 0);
}

async function generateStockInDocumentNumber(tx: Prisma.TransactionClient) {
  const today = new Date();

  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  const prefix = `IN-${yyyy}${mm}${dd}`;

  const count = await tx.stockIn.count({
    where: {
      documentNumber: {
        startsWith: prefix,
      },
    },
  });

  const sequence = String(count + 1).padStart(4, "0");

  return `${prefix}-${sequence}`;
}

function getStockInOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.StockInOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "documentNumber":
      return { documentNumber: order };

    case "invoiceNumber":
      return { invoiceNumber: order };

    case "stockInDate":
      return { stockInDate: order };

    case "supplier":
      return {
        supplier: {
          name: order,
        },
      };

    case "totalAmount":
      return { totalAmount: order };

    case "paidAmount":
      return { paidAmount: order };

    case "remainingAmount":
      return { remainingAmount: order };

    case "paymentStatus":
      return { paymentStatus: order };

    case "status":
      return { status: order };

    case "updatedAt":
      return { updatedAt: order };

    case "createdAt":
    default:
      return { createdAt: order };
  }
}

async function validateWarehouseAndRack(
  tx: Prisma.TransactionClient,
  warehouseId: string | null,
  rackLocationId: string | null,
) {
  if (warehouseId) {
    const warehouse = await tx.warehouse.findUnique({
      where: {
        id: warehouseId,
      },
      select: {
        id: true,
      },
    });

    if (!warehouse) {
      throw new Error("Warehouse tidak ditemukan");
    }
  }

  if (rackLocationId) {
    const rackLocation = await tx.rackLocation.findUnique({
      where: {
        id: rackLocationId,
      },
      select: {
        id: true,
        warehouseId: true,
      },
    });

    if (!rackLocation) {
      throw new Error("Rack location tidak ditemukan");
    }

    if (warehouseId && rackLocation.warehouseId !== warehouseId) {
      throw new Error("Rack location tidak sesuai dengan warehouse");
    }
  }
}

function normalizeItems(items: StockInItemBody[]) {
  if (items.length === 0) {
    throw new Error("Minimal harus ada 1 item barang masuk");
  }

  return items.map((item, index) => {
    const productId = item.productId?.trim();
    const warehouseId = nullableId(item.warehouseId);
    const rackLocationId = nullableId(item.rackLocationId);
    const quantity = parseInteger(item.quantity, `Quantity item ${index + 1}`);
    const unitPrice = parseDecimal(item.unitPrice, 0);
    const totalPrice = quantity * unitPrice;

    if (!productId) {
      throw new Error(`Product item ${index + 1} wajib dipilih`);
    }

    return {
      productId,
      warehouseId,
      rackLocationId,
      quantity,
      unitPrice,
      totalPrice,
    };
  });
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("stock_ins.view");

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
    const supplierId = (searchParams.get("supplierId") || "").trim();
    const status = (searchParams.get("status") || "").trim();
    const paymentStatus = (searchParams.get("paymentStatus") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = Number.isNaN(limit) || limit < 1 ? 10 : limit;
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.StockInWhereInput = {};

    if (search) {
      where.OR = [
        {
          documentNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          invoiceNumber: {
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
          supplier: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (status) {
      if (!isStockInStatus(status)) {
        return errorResponse({
          message: "Status barang masuk tidak valid",
          status: 400,
        });
      }

      where.status = status;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus as never;
    }

    if (dateFrom || dateTo) {
      where.stockInDate = {};

      if (dateFrom) {
        where.stockInDate.gte = new Date(dateFrom);
      }

      if (dateTo) {
        where.stockInDate.lte = new Date(dateTo);
      }
    }

    const [items, total] = await prisma.$transaction([
      prisma.stockIn.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
          _count: {
            select: {
              items: true,
              payments: true,
            },
          },
        },
        orderBy: getStockInOrderBy(sortBy, sortOrder),
        skip,
        take: safeLimit,
      }),

      prisma.stockIn.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Stock in retrieved successfully",
      data: {
        items: items.map((item) => ({
          ...item,
          totalAmount: toNumber(item.totalAmount),
          paidAmount: toNumber(item.paidAmount),
          remainingAmount: toNumber(item.remainingAmount),
        })),
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
    console.error("GET /api/stock-ins error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to fetch stock in",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("stock_ins.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;
    const body = (await req.json()) as CreateStockInBody;

    const supplierId = nullableId(body.supplierId);
    const invoiceNumber = nullableText(body.invoiceNumber);
    const stockInDate = parseDate(body.stockInDate);
    const notes = body.notes?.trim() || null;

    const normalizedItems = normalizeItems(body.items || []);
    const totalAmount = normalizedItems.reduce(
      (total, item) => total + item.totalPrice,
      0,
    );

    const result = await prisma.$transaction(async (tx) => {
      let documentNumber = body.documentNumber?.trim().toUpperCase() || "";

      if (!documentNumber) {
        documentNumber = await generateStockInDocumentNumber(tx);
      }

      const duplicateDocument = await tx.stockIn.findUnique({
        where: {
          documentNumber,
        },
        select: {
          id: true,
        },
      });

      if (duplicateDocument) {
        throw new Error("Nomor dokumen barang masuk sudah digunakan");
      }

      if (supplierId) {
        const supplier = await tx.supplier.findUnique({
          where: {
            id: supplierId,
          },
          select: {
            id: true,
          },
        });

        if (!supplier) {
          throw new Error("Supplier tidak ditemukan");
        }
      }

      for (const item of normalizedItems) {
        const product = await tx.product.findUnique({
          where: {
            id: item.productId,
          },
          select: {
            id: true,
          },
        });

        if (!product) {
          throw new Error("Product tidak ditemukan");
        }

        await validateWarehouseAndRack(
          tx,
          item.warehouseId,
          item.rackLocationId,
        );
      }

      const stockIn = await tx.stockIn.create({
        data: {
          supplierId,
          documentNumber,
          invoiceNumber,
          stockInDate,
          status: "POSTED",
          totalAmount,
          paidAmount: 0,
          remainingAmount: totalAmount,
          paymentStatus: "UNPAID",
          notes,
          createdById: currentUser.id,
          postedAt: new Date(),
        },
      });

      for (const item of normalizedItems) {
        const product = await tx.product.findUnique({
          where: {
            id: item.productId,
          },
          select: {
            id: true,
            name: true,
            currentStock: true,
          },
        });

        if (!product) {
          throw new Error("Product tidak ditemukan");
        }

        const stockBefore = product.currentStock;
        const stockAfter = stockBefore + item.quantity;

        await tx.stockInItem.create({
          data: {
            stockInId: stockIn.id,
            productId: item.productId,
            warehouseId: item.warehouseId,
            rackLocationId: item.rackLocationId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          },
        });

        await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            currentStock: {
              increment: item.quantity,
            },
            purchasePrice: item.unitPrice,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: item.warehouseId,
            rackLocationId: item.rackLocationId,
            type: "IN",
            quantity: item.quantity,
            stockBefore,
            stockAfter,
            referenceType: "STOCK_IN",
            referenceId: stockIn.id,
            notes: `Barang masuk ${documentNumber}`,
            createdById: currentUser.id,
          },
        });
      }

      return tx.stockIn.findUnique({
        where: {
          id: stockIn.id,
        },
        include: {
          supplier: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
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
                },
              },
            },
          },
          payments: true,
        },
      });
    });

    if (!result) {
      return errorResponse({
        message: "Gagal membuat barang masuk",
        status: 500,
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        module: "stock_ins",
        resourceType: "stock_ins",
        resourceId: result.id,
        oldData: Prisma.JsonNull,
        newData: result,
      },
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "CREATE",
      module: "stock_ins",
      relatedId: result.id,
      title: "Stock In Created",
      message: `${currentUser.name || "Someone"} created stock in ${
        result.documentNumber
      }.`,
    });

    return successResponse({
      message: "Stock in created successfully",
      data: result,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/stock-ins error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to create stock in",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
