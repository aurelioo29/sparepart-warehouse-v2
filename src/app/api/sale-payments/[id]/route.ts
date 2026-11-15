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

type UpdateSalePaymentBody = {
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

const salePaymentInclude = {
  sale: {
    include: {
      customer: true,
      salesman: true,
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

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("sale_payments.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const payment = await prisma.salePayment.findUnique({
      where: {
        id,
      },
      include: salePaymentInclude,
    });

    if (!payment) {
      return errorResponse({
        message: "Sale payment tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Sale payment retrieved successfully",
      data: normalizePaymentResponse(payment),
    });
  } catch (error) {
    console.error("GET /api/sale-payments/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to fetch sale payment",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("sale_payments.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;
    const { id } = await context.params;
    const body = (await req.json()) as UpdateSalePaymentBody;

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

    if (!isPaymentMethod(method)) {
      return errorResponse({
        message: "Metode pembayaran tidak valid",
        status: 400,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const oldPayment = await tx.salePayment.findUnique({
        where: {
          id,
        },
        include: {
          sale: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
        },
      });

      if (!oldPayment) {
        throw new Error("Sale payment tidak ditemukan");
      }

      if (oldPayment.sale.status === "CANCELLED") {
        throw new Error("Sale sudah dibatalkan");
      }

      /**
       * Saat edit, base diskon harus mengembalikan efek payment lama dulu.
       * Contoh:
       * payment lama: bayar 3.785.328 + diskon 117.072, remaining 0.
       * Base edit = 0 + 3.785.328 + 117.072 = 3.902.400.
       *
       * Kalau diedit bayar jadi 3.785.000 dan diskon tetap 3%,
       * remaining asli 328, lalu ditutup oleh toleransi pembulatan.
       */
      const discountBaseAmount =
        toNumber(oldPayment.sale.remainingAmount) +
        toNumber(oldPayment.amount) +
        toNumber(oldPayment.discountAmount);

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

      const updatedPayment = await tx.salePayment.update({
        where: {
          id: oldPayment.id,
        },
        data: {
          paymentDate,
          amount,
          discountPercent,
          discountAmount,
          method,
          referenceNumber,
          notes,
        },
        include: salePaymentInclude,
      });

      const updatedSale = await recalculateSalePaymentSummary(
        tx,
        oldPayment.saleId,
      );

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "UPDATE",
          module: "sale_payments",
          resourceType: "sale_payments",
          resourceId: updatedPayment.id,
          oldData: oldPayment,
          newData: {
            payment: updatedPayment,
            sale: updatedSale,
          },
        },
      });

      return {
        oldPayment,
        updatedPayment,
        updatedSale,
      };
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "sale_payments",
      relatedId: result.updatedPayment.id,
      title: "Sale Payment Updated",
      message: `${getActorName(currentUser)} updated payment for invoice ${
        result.updatedSale.invoiceNumber
      }.`,
    });

    return successResponse({
      message: "Sale payment updated successfully",
      data: normalizePaymentResponse(result.updatedPayment),
    });
  } catch (error) {
    console.error("PUT /api/sale-payments/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to update sale payment",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("sale_payments.delete");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;
    const { id } = await context.params;

    const result = await prisma.$transaction(async (tx) => {
      const oldPayment = await tx.salePayment.findUnique({
        where: {
          id,
        },
        include: {
          sale: true,
        },
      });

      if (!oldPayment) {
        throw new Error("Sale payment tidak ditemukan");
      }

      if (oldPayment.sale.status === "CANCELLED") {
        throw new Error("Sale sudah dibatalkan");
      }

      await tx.salePayment.delete({
        where: {
          id: oldPayment.id,
        },
      });

      const updatedSale = await recalculateSalePaymentSummary(
        tx,
        oldPayment.saleId,
      );

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "DELETE",
          module: "sale_payments",
          resourceType: "sale_payments",
          resourceId: oldPayment.id,
          oldData: oldPayment,
          newData: {
            sale: updatedSale,
          },
        },
      });

      return {
        oldPayment,
        updatedSale,
      };
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "DELETE",
      module: "sale_payments",
      relatedId: result.oldPayment.id,
      title: "Sale Payment Deleted",
      message: `${getActorName(currentUser)} deleted payment for invoice ${
        result.updatedSale.invoiceNumber
      }.`,
    });

    return successResponse({
      message: "Sale payment deleted successfully",
      data: {
        deletedPayment: {
          ...result.oldPayment,
          amount: toNumber(result.oldPayment.amount),
          discountPercent: toNumber(result.oldPayment.discountPercent),
          discountAmount: toNumber(result.oldPayment.discountAmount),
        },
        sale: {
          ...result.updatedSale,
          totalAmount: toNumber(result.updatedSale.totalAmount),
          paidAmount: toNumber(result.updatedSale.paidAmount),
          remainingAmount: toNumber(result.updatedSale.remainingAmount),
        },
      },
    });
  } catch (error) {
    console.error("DELETE /api/sale-payments/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete sale payment",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
