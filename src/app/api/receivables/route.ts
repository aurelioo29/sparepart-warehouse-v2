import { Prisma } from "@/../prisma/generated/prisma/client";
import ExcelJS from "exceljs";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

type ReceivableExportItem = Prisma.SaleGetPayload<{
  include: {
    customer: {
      select: {
        id: true;
        name: true;
        phone: true;
      };
    };
    salesman: {
      select: {
        id: true;
        code: true;
        name: true;
      };
    };
    _count: {
      select: {
        items: true;
        payments: true;
      };
    };
  };
}>;

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value || 0);
}

function formatDateForFile() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: Date | string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function getOverdueDays(dueDate?: Date | string | null) {
  if (!dueDate) return 0;

  const due = new Date(dueDate);
  const today = new Date();

  if (Number.isNaN(due.getTime())) return 0;

  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diff = today.getTime() - due.getTime();

  if (diff <= 0) return 0;

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function buildReceivableWhere(params: {
  search: string;
  customerId: string;
  salesmanId: string;
  overdueOnly: string;
}) {
  const where: Prisma.SaleWhereInput = {
    status: "POSTED",
    remainingAmount: {
      gt: 0,
    },
  };

  if (params.search) {
    where.OR = [
      {
        invoiceNumber: {
          contains: params.search,
          mode: "insensitive",
        },
      },
      {
        customer: {
          name: {
            contains: params.search,
            mode: "insensitive",
          },
        },
      },
      {
        salesman: {
          name: {
            contains: params.search,
            mode: "insensitive",
          },
        },
      },
      {
        notes: {
          contains: params.search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (params.customerId) {
    where.customerId = params.customerId;
  }

  if (params.salesmanId) {
    where.salesmanId = params.salesmanId;
  }

  if (params.overdueOnly === "true") {
    where.dueDate = {
      lt: new Date(),
    };
  }

  return where;
}

function getReceivableOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.SaleOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "invoiceNumber":
      return { invoiceNumber: order };

    case "saleDate":
      return { saleDate: order };

    case "dueDate":
      return { dueDate: order };

    case "customer":
      return {
        customer: {
          name: order,
        },
      };

    case "salesman":
      return {
        salesman: {
          name: order,
        },
      };

    case "totalAmount":
      return { totalAmount: order };

    case "paidAmount":
      return { paidAmount: order };

    case "remainingAmount":
      return { remainingAmount: order };

    case "createdAt":
    default:
      return { dueDate: "asc" };
  }
}

function applyThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
}

function createExcelResponse(params: {
  buffer: ExcelJS.Buffer;
  filename: string;
}) {
  return new Response(params.buffer as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${params.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function createReceivablesWorkbook(params: {
  items: ReceivableExportItem[];
}) {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Sparepart Warehouse";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Receivables", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  worksheet.views = [
    {
      state: "frozen",
      ySplit: 6,
      showGridLines: false,
    },
  ];

  worksheet.columns = [
    { key: "no", width: 8 },
    { key: "invoiceNumber", width: 24 },
    { key: "saleDate", width: 16 },
    { key: "dueDate", width: 16 },
    { key: "customerName", width: 30 },
    { key: "customerPhone", width: 18 },
    { key: "salesmanName", width: 22 },
    { key: "totalAmount", width: 18 },
    { key: "paidAmount", width: 18 },
    { key: "remainingAmount", width: 22 },
    { key: "paymentStatus", width: 18 },
    { key: "overdueDays", width: 16 },
    { key: "itemCount", width: 12 },
    { key: "paymentCount", width: 14 },
  ];

  worksheet.mergeCells("A1:N1");
  worksheet.mergeCells("A2:N2");

  worksheet.getCell("A1").value = "Laporan Piutang / Receivables";
  worksheet.getCell("A2").value = `Tanggal Export: ${formatDate(new Date())}`;

  worksheet.getRow(1).height = 26;
  worksheet.getRow(2).height = 22;

  worksheet.getCell("A1").font = {
    name: "Calibri",
    size: 16,
    bold: true,
  };

  worksheet.getCell("A2").font = {
    name: "Calibri",
    size: 11,
    bold: true,
  };

  worksheet.getCell("A1").alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  worksheet.getCell("A2").alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  const totalInvoices = params.items.length;

  const totalAmount = params.items.reduce(
    (total, item) => total + toNumber(item.totalAmount),
    0,
  );

  const totalPaid = params.items.reduce(
    (total, item) => total + toNumber(item.paidAmount),
    0,
  );

  const totalReceivable = params.items.reduce(
    (total, item) => total + toNumber(item.remainingAmount),
    0,
  );

  const overdueItems = params.items.filter(
    (item) => getOverdueDays(item.dueDate) > 0,
  );

  const overdueAmount = overdueItems.reduce(
    (total, item) => total + toNumber(item.remainingAmount),
    0,
  );

  worksheet.getCell("A4").value = "Invoices";
  worksheet.getCell("B4").value = totalInvoices;

  worksheet.getCell("D4").value = "Total Amount";
  worksheet.getCell("E4").value = totalAmount;

  worksheet.getCell("G4").value = "Total Paid";
  worksheet.getCell("H4").value = totalPaid;

  worksheet.getCell("J4").value = "Total Receivable";
  worksheet.getCell("K4").value = totalReceivable;

  worksheet.getCell("M4").value = "Overdue Amount";
  worksheet.getCell("N4").value = overdueAmount;

  ["A4", "D4", "G4", "J4", "M4"].forEach((cellAddress) => {
    worksheet.getCell(cellAddress).font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FF475569" },
    };
  });

  ["B4", "E4", "H4", "K4", "N4"].forEach((cellAddress) => {
    worksheet.getCell(cellAddress).font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FF0F172A" },
    };
  });

  worksheet.getCell("E4").numFmt = '"Rp" #,##0';
  worksheet.getCell("H4").numFmt = '"Rp" #,##0';
  worksheet.getCell("K4").numFmt = '"Rp" #,##0';
  worksheet.getCell("N4").numFmt = '"Rp" #,##0';

  const headerRowNumber = 6;
  const headerRow = worksheet.getRow(headerRowNumber);

  headerRow.values = [
    "No",
    "Invoice",
    "Sale Date",
    "Due Date",
    "Customer",
    "Phone",
    "Salesman",
    "Total Amount",
    "Paid Amount",
    "Remaining Amount",
    "Payment Status",
    "Overdue Days",
    "Items",
    "Payments",
  ];

  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };

    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    applyThinBorder(cell);
  });

  params.items.forEach((item, index) => {
    const row = worksheet.getRow(headerRowNumber + index + 1);

    row.values = [
      index + 1,
      item.invoiceNumber,
      formatDate(item.saleDate),
      formatDate(item.dueDate),
      item.customer?.name || "Walk-in Customer",
      item.customer?.phone || "-",
      item.salesman?.name || "-",
      toNumber(item.totalAmount),
      toNumber(item.paidAmount),
      toNumber(item.remainingAmount),
      item.paymentStatus,
      getOverdueDays(item.dueDate),
      item._count?.items || 0,
      item._count?.payments || 0,
    ];

    row.height = 22;

    row.eachCell((cell, colNumber) => {
      cell.font = {
        name: "Calibri",
        size: 11,
      };

      cell.alignment = {
        vertical: "middle",
        horizontal:
          colNumber === 1 ||
          colNumber === 11 ||
          colNumber === 12 ||
          colNumber === 13 ||
          colNumber === 14
            ? "center"
            : colNumber >= 8 && colNumber <= 10
              ? "right"
              : "left",
      };

      if (index % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }

      applyThinBorder(cell);
    });

    row.getCell(8).numFmt = '"Rp" #,##0';
    row.getCell(9).numFmt = '"Rp" #,##0';
    row.getCell(10).numFmt = '"Rp" #,##0';

    if (getOverdueDays(item.dueDate) > 0) {
      row.getCell(12).font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "FFDC2626" },
      };
    }

    if (item.paymentStatus === "UNPAID") {
      row.getCell(11).font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "FFEA580C" },
      };
    }

    if (item.paymentStatus === "PARTIAL") {
      row.getCell(11).font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "FF2563EB" },
      };
    }

    if (item.paymentStatus === "PAID") {
      row.getCell(11).font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "FF16A34A" },
      };
    }
  });

  const totalRowNumber = headerRowNumber + params.items.length + 1;
  const totalRow = worksheet.getRow(totalRowNumber);

  totalRow.values = [
    "",
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    totalAmount,
    totalPaid,
    totalReceivable,
    "",
    "",
    "",
    "",
  ];

  worksheet.mergeCells(`B${totalRowNumber}:G${totalRowNumber}`);

  totalRow.height = 24;

  totalRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FF0F172A" },
    };

    cell.alignment = {
      horizontal: colNumber >= 8 && colNumber <= 10 ? "right" : "center",
      vertical: "middle",
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0F2FE" },
    };

    applyThinBorder(cell);
  });

  totalRow.getCell(8).numFmt = '"Rp" #,##0';
  totalRow.getCell(9).numFmt = '"Rp" #,##0';
  totalRow.getCell(10).numFmt = '"Rp" #,##0';

  worksheet.autoFilter = {
    from: {
      row: headerRowNumber,
      column: 1,
    },
    to: {
      row: headerRowNumber,
      column: 14,
    },
  };

  const buffer = await workbook.xlsx.writeBuffer();

  return buffer;
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

    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);

    const search = (searchParams.get("search") || "").trim();
    const customerId = (searchParams.get("customerId") || "").trim();
    const salesmanId = (searchParams.get("salesmanId") || "").trim();
    const overdueOnly = (searchParams.get("overdueOnly") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "dueDate").trim();
    const sortOrder = (searchParams.get("sortOrder") || "asc").trim();

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = Number.isNaN(limit) || limit < 1 ? 10 : limit;
    const skip = (safePage - 1) * safeLimit;

    const where = buildReceivableWhere({
      search,
      customerId,
      salesmanId,
      overdueOnly,
    });

    if (exportType === "xlsx") {
      const items = await prisma.sale.findMany({
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
              code: true,
              name: true,
            },
          },
          _count: {
            select: {
              items: true,
              payments: true,
            },
          },
        },
        orderBy: getReceivableOrderBy(sortBy, sortOrder),
      });

      const buffer = await createReceivablesWorkbook({
        items,
      });

      return createExcelResponse({
        buffer,
        filename: `receivables-${formatDateForFile()}.xlsx`,
      });
    }

    const [items, total, allReceivables] = await prisma.$transaction([
      prisma.sale.findMany({
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
              code: true,
              name: true,
            },
          },
          _count: {
            select: {
              items: true,
              payments: true,
            },
          },
        },
        orderBy: getReceivableOrderBy(sortBy, sortOrder),
        skip,
        take: safeLimit,
      }),

      prisma.sale.count({
        where,
      }),

      prisma.sale.findMany({
        where,
        select: {
          id: true,
          remainingAmount: true,
          dueDate: true,
        },
      }),
    ]);

    const totalReceivable = allReceivables.reduce(
      (sum, item) => sum + toNumber(item.remainingAmount),
      0,
    );

    const overdueItems = allReceivables.filter(
      (item) => getOverdueDays(item.dueDate) > 0,
    );

    const overdueAmount = overdueItems.reduce(
      (sum, item) => sum + toNumber(item.remainingAmount),
      0,
    );

    return successResponse({
      message: "Receivables retrieved successfully",
      data: {
        summary: {
          totalInvoices: total,
          totalReceivable,
          overdueInvoices: overdueItems.length,
          overdueAmount,
        },
        items: items.map((item) => ({
          ...item,
          totalAmount: toNumber(item.totalAmount),
          paidAmount: toNumber(item.paidAmount),
          remainingAmount: toNumber(item.remainingAmount),
          overdueDays: getOverdueDays(item.dueDate),
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
    console.error("GET /api/receivables error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to fetch receivables",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
