import {
  Prisma,
  PurchasePaymentStatus,
} from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { excelResponse } from "@/lib/excel";

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value || 0);
}

function formatDateForFile() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toISOString().slice(0, 10);
}

function formatRupiahForExcel(value: string | number | null | undefined) {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))}`;
}

function getTodayDateOnly() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getOverdueDays(
  dueDate: Date | null | undefined,
  remainingAmount: number,
) {
  if (!dueDate || remainingAmount <= 0) return 0;

  const today = getTodayDateOnly();
  const due = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );

  if (due >= today) return 0;

  const diffMs = today.getTime() - due.getTime();

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isPurchasePaymentStatus(
  value: string,
): value is PurchasePaymentStatus {
  return ["UNPAID", "PARTIAL", "PAID"].includes(value);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const exportType = (searchParams.get("export") || "").trim();

    const auth = await requirePermission(
      exportType === "xlsx" ? "payables.export" : "payables.view",
    );

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const search = (searchParams.get("search") || "").trim();
    const supplierId = (searchParams.get("supplierId") || "").trim();
    const paymentStatus = (searchParams.get("paymentStatus") || "").trim();
    const overdueOnly = (searchParams.get("overdueOnly") || "").trim();

    const where: Prisma.StockInWhereInput = {
      status: "POSTED",
      remainingAmount: {
        gt: 0,
      },
    };

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

    if (paymentStatus) {
      if (!isPurchasePaymentStatus(paymentStatus)) {
        return errorResponse({
          message: "Payment status tidak valid",
          status: 400,
        });
      }

      where.paymentStatus = paymentStatus;
    }

    const stockIns = await prisma.stockIn.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
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
      orderBy: [
        {
          dueDate: "asc",
        },
        {
          stockInDate: "desc",
        },
      ],
    });

    let items = stockIns.map((stockIn) => {
      const totalAmount = toNumber(stockIn.totalAmount);
      const paidAmount = toNumber(stockIn.paidAmount);
      const remainingAmount = toNumber(stockIn.remainingAmount);
      const overdueDays = getOverdueDays(stockIn.dueDate, remainingAmount);

      return {
        id: stockIn.id,
        documentNumber: stockIn.documentNumber,
        invoiceNumber: stockIn.invoiceNumber,
        stockInDate: stockIn.stockInDate,
        dueDate: stockIn.dueDate,
        supplier: stockIn.supplier,
        totalAmount,
        paidAmount,
        remainingAmount,
        paymentStatus: stockIn.paymentStatus,
        overdueDays,
        itemCount: stockIn._count.items,
        paymentCount: stockIn._count.payments,
        createdBy: stockIn.createdBy,
      };
    });

    if (overdueOnly === "true") {
      items = items.filter((item) => item.overdueDays > 0);
    }

    items = items.sort((a, b) => {
      if (a.overdueDays > 0 && b.overdueDays === 0) return -1;
      if (a.overdueDays === 0 && b.overdueDays > 0) return 1;

      const dueA = a.dueDate
        ? new Date(a.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;

      const dueB = b.dueDate
        ? new Date(b.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;

      if (dueA !== dueB) return dueA - dueB;

      return (
        new Date(b.stockInDate).getTime() - new Date(a.stockInDate).getTime()
      );
    });

    const summary = items.reduce(
      (acc, item) => {
        acc.totalInvoices += 1;
        acc.totalDebt += item.remainingAmount;

        if (item.overdueDays > 0) {
          acc.overdueInvoices += 1;
          acc.overdueDebt += item.remainingAmount;
        }

        return acc;
      },
      {
        totalInvoices: 0,
        totalDebt: 0,
        overdueInvoices: 0,
        overdueDebt: 0,
      },
    );

    if (exportType === "xlsx") {
      return excelResponse({
        filename: `payables-report-${formatDateForFile()}.xlsx`,
        sheetName: "Payables",
        columns: [
          { header: "Document Number", key: "documentNumber", width: 22 },
          { header: "No Faktur", key: "invoiceNumber", width: 20 },
          { header: "Stock In Date", key: "stockInDate", width: 16 },
          { header: "Due Date", key: "dueDate", width: 16 },
          { header: "Supplier", key: "supplier", width: 28 },
          { header: "Total", key: "totalAmount", width: 20 },
          { header: "Paid", key: "paidAmount", width: 20 },
          { header: "Remaining", key: "remainingAmount", width: 20 },
          { header: "Payment Status", key: "paymentStatus", width: 18 },
          { header: "Overdue Days", key: "overdueDays", width: 16 },
        ],
        rows: items.map((item) => ({
          documentNumber: item.documentNumber,
          invoiceNumber: item.invoiceNumber || "-",
          stockInDate: formatDate(item.stockInDate),
          dueDate: formatDate(item.dueDate),
          supplier: item.supplier?.name || "-",
          totalAmount: formatRupiahForExcel(item.totalAmount),
          paidAmount: formatRupiahForExcel(item.paidAmount),
          remainingAmount: formatRupiahForExcel(item.remainingAmount),
          paymentStatus: item.paymentStatus,
          overdueDays: item.overdueDays,
        })),
      });
    }

    return successResponse({
      message: "Payables retrieved successfully",
      data: {
        summary,
        items,
      },
    });
  } catch (error) {
    console.error("GET /api/payables error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to fetch payables",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
