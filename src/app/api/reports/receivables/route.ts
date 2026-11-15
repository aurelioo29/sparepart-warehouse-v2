import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { excelResponse } from "@/lib/excel";

function formatDateForFile() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value || 0);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toISOString().slice(0, 10);
}

function formatRupiahForExcel(value: string | number | null | undefined) {
  const numberValue = Number(value || 0);

  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(numberValue)}`;
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const exportType = (searchParams.get("export") || "").trim();

    const auth = await requirePermission(
      exportType === "xlsx" ? "receivables.export" : "receivables.view",
    );

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const search = (searchParams.get("search") || "").trim();
    const customerId = (searchParams.get("customerId") || "").trim();
    const salesmanId = (searchParams.get("salesmanId") || "").trim();
    const overdueOnly = (searchParams.get("overdueOnly") || "").trim();

    const where: Prisma.SaleWhereInput = {
      status: "POSTED",
      remainingAmount: {
        gt: 0,
      },
    };

    if (search) {
      where.OR = [
        {
          invoiceNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customer: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          customer: {
            phone: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          salesman: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (salesmanId) {
      where.salesmanId = salesmanId;
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        salesman: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          dueDate: "asc",
        },
        {
          saleDate: "desc",
        },
      ],
    });

    let items = sales.map((sale) => {
      const totalAmount = toNumber(sale.totalAmount);
      const paidAmount = toNumber(sale.paidAmount);
      const remainingAmount = toNumber(sale.remainingAmount);
      const overdueDays = getOverdueDays(sale.dueDate, remainingAmount);

      return {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        saleDate: sale.saleDate,
        dueDate: sale.dueDate,
        customer: sale.customer,
        salesman: sale.salesman,
        totalAmount,
        paidAmount,
        remainingAmount,
        paymentStatus: sale.paymentStatus,
        overdueDays,
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

      return new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
    });

    const summary = items.reduce(
      (acc, item) => {
        acc.totalInvoices += 1;
        acc.totalReceivable += item.remainingAmount;

        if (item.overdueDays > 0) {
          acc.overdueInvoices += 1;
          acc.overdueAmount += item.remainingAmount;
        }

        return acc;
      },
      {
        totalInvoices: 0,
        totalReceivable: 0,
        overdueInvoices: 0,
        overdueAmount: 0,
      },
    );

    if (exportType === "xlsx") {
      const exportRows = items.map((item) => ({
        invoiceNumber: item.invoiceNumber,
        saleDate: formatDate(item.saleDate),
        dueDate: formatDate(item.dueDate),
        customer: item.customer?.name || "-",
        phone: item.customer?.phone || "-",
        salesman: item.salesman?.name || "-",
        totalAmount: formatRupiahForExcel(item.totalAmount),
        paidAmount: formatRupiahForExcel(item.paidAmount),
        remainingAmount: formatRupiahForExcel(item.remainingAmount),
        paymentStatus: item.paymentStatus,
        overdueDays: item.overdueDays,
      }));

      return excelResponse({
        filename: `receivables-report-${formatDateForFile()}.xlsx`,
        sheetName: "Receivables",
        columns: [
          {
            header: "Invoice",
            key: "invoiceNumber",
            width: 22,
          },
          {
            header: "Sale Date",
            key: "saleDate",
            width: 16,
          },
          {
            header: "Due Date",
            key: "dueDate",
            width: 16,
          },
          {
            header: "Customer",
            key: "customer",
            width: 28,
          },
          {
            header: "Phone",
            key: "phone",
            width: 18,
          },
          {
            header: "Salesman",
            key: "salesman",
            width: 24,
          },
          {
            header: "Total",
            key: "totalAmount",
            width: 20,
          },
          {
            header: "Paid",
            key: "paidAmount",
            width: 20,
          },
          {
            header: "Remaining",
            key: "remainingAmount",
            width: 20,
          },
          {
            header: "Status",
            key: "paymentStatus",
            width: 16,
          },
          {
            header: "Overdue Days",
            key: "overdueDays",
            width: 16,
          },
        ],
        rows: exportRows,
      });
    }

    return successResponse({
      message: "Receivables retrieved successfully",
      data: {
        summary,
        items,
      },
    });
  } catch (error) {
    console.error("GET /api/receivables error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to fetch receivables",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
