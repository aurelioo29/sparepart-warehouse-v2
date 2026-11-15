import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type SalePaymentBody = {
  saleId?: string;
  paymentDate?: string | null;
  amount?: number | string | null;
  discountType?: "NONE" | "PERCENT" | "AMOUNT" | null;
  discountPercent?: number | string | null;
  discountAmount?: number | string | null;
  method?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
};

const paymentMethods = [
  "CASH",
  "TRANSFER",
  "DEBIT",
  "CREDIT",
  "QRIS",
  "OTHER",
] as const;

type PaymentMethodValue = (typeof paymentMethods)[number];

function isPaymentMethod(value: string): value is PaymentMethodValue {
  return paymentMethods.includes(value as PaymentMethodValue);
}

function parseDate(value: unknown) {
  if (!value) return new Date();

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal pembayaran tidak valid");
  }

  return date;
}

function parseDecimal(value: unknown) {
  const numberValue = Number(value);

  if (Number.isNaN(numberValue) || numberValue <= 0) {
    throw new Error("Nominal pembayaran harus lebih dari 0");
  }

  return numberValue;
}

function parseDiscountPercent(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue) || numberValue < 0 || numberValue > 100) {
    throw new Error("Diskon persen harus di antara 0 - 100");
  }

  return numberValue;
}

function parseDiscountAmount(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue) || numberValue < 0) {
    throw new Error("Diskon nominal harus berupa angka minimal 0");
  }

  return roundMoney(numberValue);
}

function parseDiscountType(value: unknown) {
  const discountType = String(value || "NONE")
    .trim()
    .toUpperCase();

  if (
    discountType !== "NONE" &&
    discountType !== "PERCENT" &&
    discountType !== "AMOUNT"
  ) {
    throw new Error("Tipe diskon pembayaran tidak valid");
  }

  return discountType as "NONE" | "PERCENT" | "AMOUNT";
}

function nullableText(value: string | null | undefined) {
  const clean = value?.trim();

  return clean ? clean : null;
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value || 0);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getDiscountAmount(baseAmount: number, discountPercent: number) {
  if (!baseAmount || baseAmount <= 0) return 0;
  if (!discountPercent || discountPercent <= 0) return 0;

  return Math.min(roundMoney((baseAmount * discountPercent) / 100), baseAmount);
}

/**
 * Kalau ada diskon dan sisa tagihan kecil karena pembulatan,
 * sistem tetap anggap lunas.
 *
 * Contoh:
 * Total 3.902.400
 * Cash 3.785.000
 * Diskon 3% = 117.072
 * Sisa asli = 328
 * Karena 328 <= 1.000 dan ada diskon, status jadi PAID.
 */
const PAYMENT_DISCOUNT_SETTLEMENT_TOLERANCE = 1000;

function shouldForcePaidByDiscountTolerance(params: {
  totalAmount: number;
  settledAmount: number;
  paymentDiscountAmount: number;
}) {
  const remainingAmount = params.totalAmount - params.settledAmount;

  return (
    params.paymentDiscountAmount > 0 &&
    remainingAmount > 0 &&
    remainingAmount <= PAYMENT_DISCOUNT_SETTLEMENT_TOLERANCE
  );
}

function getRemainingAmountAfterSettlement(params: {
  totalAmount: number;
  settledAmount: number;
  paymentDiscountAmount: number;
}) {
  const remainingAmount = params.totalAmount - params.settledAmount;

  if (remainingAmount <= 0) return 0;

  if (shouldForcePaidByDiscountTolerance(params)) {
    return 0;
  }

  return remainingAmount;
}

function getPaymentStatusAfterSettlement(params: {
  totalAmount: number;
  settledAmount: number;
  paymentDiscountAmount: number;
}) {
  if (params.settledAmount <= 0) return "UNPAID";

  if (params.settledAmount >= params.totalAmount) {
    return "PAID";
  }

  if (shouldForcePaidByDiscountTolerance(params)) {
    return "PAID";
  }

  return "PARTIAL";
}

function getActorName(user: {
  name?: string | null;
  username?: string | null;
}) {
  return user.name || user.username || "Someone";
}

function getSalePaymentOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.SalePaymentOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "paymentDate":
      return { paymentDate: order };

    case "amount":
      return { amount: order };

    case "discountPercent":
      return { discountPercent: order };

    case "discountAmount":
      return { discountAmount: order };

    case "method":
      return { method: order };

    case "invoiceNumber":
      return {
        sale: {
          invoiceNumber: order,
        },
      };

    case "createdAt":
    default:
      return { createdAt: order };
  }
}

const salePaymentInclude = {
  sale: {
    select: {
      id: true,
      invoiceNumber: true,
      saleDate: true,
      totalAmount: true,
      paidAmount: true,
      remainingAmount: true,
      paymentStatus: true,
      status: true,
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
      salesman: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  createdBy: {
    select: {
      id: true,
      fullName: true,
      username: true,
    },
  },
};

function normalizePaymentResponse<
  T extends {
    amount: Prisma.Decimal | number | string;
    discountPercent?: Prisma.Decimal | number | string | null;
    discountAmount?: Prisma.Decimal | number | string | null;
    sale?: {
      totalAmount: Prisma.Decimal | number | string;
      paidAmount: Prisma.Decimal | number | string;
      remainingAmount: Prisma.Decimal | number | string;
    } | null;
  },
>(payment: T) {
  return {
    ...payment,
    amount: toNumber(payment.amount),
    discountPercent: toNumber(payment.discountPercent),
    discountAmount: toNumber(payment.discountAmount),
    sale: payment.sale
      ? {
          ...payment.sale,
          totalAmount: toNumber(payment.sale.totalAmount),
          paidAmount: toNumber(payment.sale.paidAmount),
          remainingAmount: toNumber(payment.sale.remainingAmount),
        }
      : null,
  };
}

async function recalculateSalePaymentSummary(
  tx: Prisma.TransactionClient,
  saleId: string,
) {
  const sale = await tx.sale.findUnique({
    where: {
      id: saleId,
    },
    include: {
      payments: {
        select: {
          amount: true,
          discountAmount: true,
        },
      },
    },
  });

  if (!sale) {
    throw new Error("Sale tidak ditemukan");
  }

  const totalAmount = toNumber(sale.totalAmount);

  const paidAmount = sale.payments.reduce(
    (total, payment) => total + toNumber(payment.amount),
    0,
  );

  const paymentDiscountAmount = sale.payments.reduce(
    (total, payment) => total + toNumber(payment.discountAmount),
    0,
  );

  const settledAmount = paidAmount + paymentDiscountAmount;

  const remainingAmount = getRemainingAmountAfterSettlement({
    totalAmount,
    settledAmount,
    paymentDiscountAmount,
  });

  const paymentStatus = getPaymentStatusAfterSettlement({
    totalAmount,
    settledAmount,
    paymentDiscountAmount,
  });

  return tx.sale.update({
    where: {
      id: sale.id,
    },
    data: {
      paidAmount,
      remainingAmount,
      paymentStatus,
    },
    include: {
      customer: true,
      salesman: true,
      payments: true,
    },
  });
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("sale_payments.view");

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
    const saleId = (searchParams.get("saleId") || "").trim();
    const method = (searchParams.get("method") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = Number.isNaN(limit) || limit < 1 ? 10 : limit;
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.SalePaymentWhereInput = {};

    if (search) {
      where.OR = [
        {
          referenceNumber: {
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
          sale: {
            invoiceNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          sale: {
            customer: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    if (saleId) {
      where.saleId = saleId;
    }

    if (method) {
      if (!isPaymentMethod(method)) {
        return errorResponse({
          message: "Metode pembayaran tidak valid",
          status: 400,
        });
      }

      where.method = method;
    }

    if (dateFrom || dateTo) {
      where.paymentDate = {};

      if (dateFrom) {
        where.paymentDate.gte = new Date(`${dateFrom}T00:00:00`);
      }

      if (dateTo) {
        where.paymentDate.lte = new Date(`${dateTo}T23:59:59.999`);
      }
    }

    const [items, total] = await prisma.$transaction([
      prisma.salePayment.findMany({
        where,
        include: salePaymentInclude,
        orderBy: getSalePaymentOrderBy(sortBy, sortOrder),
        skip,
        take: safeLimit,
      }),

      prisma.salePayment.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Sale payments retrieved successfully",
      data: {
        items: items.map((item) => normalizePaymentResponse(item)),
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
    console.error("GET /api/sale-payments error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch sale payments",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("sale_payments.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;
    const body = (await req.json()) as SalePaymentBody;

    const saleId = body.saleId?.trim();
    const paymentDate = parseDate(body.paymentDate);
    const amount = parseDecimal(body.amount);
    const requestedDiscountPercent = parseDiscountPercent(body.discountPercent);
    const requestedDiscountAmount = parseDiscountAmount(body.discountAmount);
    const discountType = body.discountType
      ? parseDiscountType(body.discountType)
      : requestedDiscountAmount > 0
        ? "AMOUNT"
        : requestedDiscountPercent > 0
          ? "PERCENT"
          : "NONE";
    const method = body.method?.trim() || "CASH";
    const referenceNumber = nullableText(body.referenceNumber);
    const notes = nullableText(body.notes);

    if (!saleId) {
      return errorResponse({
        message: "Invoice penjualan wajib dipilih",
        status: 400,
      });
    }

    if (!isPaymentMethod(method)) {
      return errorResponse({
        message: "Metode pembayaran tidak valid",
        status: 400,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: {
          id: saleId,
        },
        include: {
          customer: true,
          salesman: true,
          payments: true,
        },
      });

      if (!sale) {
        throw new Error("Sale tidak ditemukan");
      }

      if (sale.status === "CANCELLED") {
        throw new Error("Sale sudah dibatalkan");
      }

      const discountBaseAmount = toNumber(sale.remainingAmount);

      const discountPercent =
        discountType === "PERCENT" ? requestedDiscountPercent : 0;

      const discountAmount =
        discountType === "PERCENT"
          ? getDiscountAmount(discountBaseAmount, discountPercent)
          : discountType === "AMOUNT"
            ? Math.min(requestedDiscountAmount, discountBaseAmount)
            : 0;

      if (amount + discountAmount > discountBaseAmount) {
        throw new Error(
          "Pembayaran ditambah diskon tidak boleh melebihi sisa tagihan",
        );
      }

      const payment = await tx.salePayment.create({
        data: {
          saleId: sale.id,
          paymentDate,
          amount,
          discountPercent,
          discountAmount,
          method,
          referenceNumber,
          notes,
          createdById: currentUser.id,
        },
        include: salePaymentInclude,
      });

      const updatedSale = await recalculateSalePaymentSummary(tx, sale.id);

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "CREATE",
          module: "sale_payments",
          resourceType: "sale_payments",
          resourceId: payment.id,
          oldData: sale,
          newData: {
            payment,
            sale: updatedSale,
          },
        },
      });

      return {
        payment,
        oldSale: sale,
        updatedSale,
      };
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "CREATE",
      module: "sale_payments",
      relatedId: result.payment.id,
      title: "Sale Payment Created",
      message: `${getActorName(currentUser)} created payment for invoice ${
        result.updatedSale.invoiceNumber
      }.`,
    });

    return successResponse({
      message: "Sale payment created successfully",
      data: normalizePaymentResponse(result.payment),
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/sale-payments error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to create sale payment",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
