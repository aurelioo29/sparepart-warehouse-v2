import { Prisma } from "@/../prisma/generated/prisma/client";
import ExcelJS from "exceljs";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type SaleItemBody = {
  productId?: string;
  warehouseId?: string | null;
  rackLocationId?: string | null;
  quantity?: number | string;
  unitPrice?: number | string | null;
  discountPercent?: number | string | null;
  additionalDiscountPercent?: number | string | null;
  additionalDiscountPercent2?: number | string | null;
};

type CreateSaleBody = {
  customerId?: string | null;
  salesmanId?: string | null;
  invoiceNumber?: string | null;
  saleDate?: string | null;
  dueDate?: string | null;
  paidAmount?: number | string | null;
  notes?: string | null;
  items?: SaleItemBody[];
};

type SalesInvoiceExportItem = Prisma.SaleGetPayload<{
  include: {
    customer: {
      select: {
        id: true;
        name: true;
        address: true;
        customerType: true;
      };
    };
    salesman: {
      select: {
        id: true;
        code: true;
        name: true;
      };
    };
    createdBy: {
      select: {
        id: true;
        fullName: true;
        username: true;
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

function nullableId(value: string | null | undefined) {
  const clean = value?.trim();

  return clean ? clean : null;
}

function parseDate(value: unknown) {
  if (!value) return new Date();

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal penjualan tidak valid");
  }

  return date;
}

function parseNullableDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal jatuh tempo tidak valid");
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
  if (value === null || value === undefined || value === "") return fallback;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue) || numberValue < 0) {
    throw new Error("Nominal harus berupa angka minimal 0");
  }

  return numberValue;
}

function parsePercent(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue) || numberValue < 0 || numberValue > 100) {
    throw new Error("Diskon persen harus berupa angka 0 sampai 100");
  }

  return numberValue;
}

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

function formatDateTime(value?: Date | string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatRupiah(value: number) {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))}`;
}

function formatCustomerNameAddress(
  customer?: {
    name?: string | null;
    address?: string | null;
  } | null,
) {
  if (!customer?.name) return "Walk-in Customer";

  const address = customer.address?.trim() || "-";

  return `${customer.name} - ${address}`;
}

function calculateSaleItemTotal({
  quantity,
  unitPrice,
  discountPercent,
  additionalDiscountPercent,
  additionalDiscountPercent2,
}: {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  additionalDiscountPercent: number;
  additionalDiscountPercent2: number;
}) {
  const subtotal = quantity * unitPrice;
  const mainDiscountAmount = subtotal * (discountPercent / 100);

  const afterMainDiscount = subtotal - mainDiscountAmount;

  const additionalDiscountAmount =
    afterMainDiscount * (additionalDiscountPercent / 100);

  const afterAdditionalDiscount = afterMainDiscount - additionalDiscountAmount;

  const additionalDiscountAmount2 =
    afterAdditionalDiscount * (additionalDiscountPercent2 / 100);

  const discountAmount =
    mainDiscountAmount + additionalDiscountAmount + additionalDiscountAmount2;

  const totalPrice = Math.max(subtotal - discountAmount, 0);

  return {
    subtotal,
    discountAmount,
    totalPrice,
  };
}

async function generateInvoiceNumber(tx: Prisma.TransactionClient) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const yyyy = getPart("year");
  const mm = getPart("month");
  const dd = getPart("day");

  const datePrefix = `INV-${yyyy}${mm}${dd}-`;
  const monthPrefix = `INV-${yyyy}${mm}`;
  const jakartaDate = `${yyyy}-${mm}-${dd}`;

  // Sebelum 1 Oktober: nomor tetap reset setiap hari seperti sekarang.
  // Mulai 1 Oktober: nomor lanjut sepanjang bulan.
  const useMonthlySequence = jakartaDate >= "2026-10-01";
  const searchPrefix = useMonthlySequence ? monthPrefix : datePrefix;

  const existingSales = await tx.sale.findMany({
    where: {
      invoiceNumber: { startsWith: searchPrefix },
    },
    select: {
      invoiceNumber: true,
    },
  });

  const pattern = useMonthlySequence
    ? new RegExp(`^INV-${yyyy}${mm}\\d{2}-(\\d+)$`)
    : new RegExp(`^INV-${yyyy}${mm}${dd}-(\\d+)$`);

  const lastSequence = existingSales.reduce((highest, sale) => {
    const match = sale.invoiceNumber.match(pattern);
    if (!match) return highest;

    const sequence = Number(match[1]);
    return Number.isInteger(sequence) ? Math.max(highest, sequence) : highest;
  }, 0);

  return `${datePrefix}${String(lastSequence + 1).padStart(4, "0")}`;
}

function getSaleOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.SaleOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "invoiceNumber":
      return { invoiceNumber: order };

    case "saleDate":
      return { saleDate: order };

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

function getPaymentStatus(totalAmount: number, paidAmount: number) {
  if (paidAmount <= 0) return "UNPAID";
  if (paidAmount >= totalAmount) return "PAID";

  return "PARTIAL";
}

function buildSaleWhere(params: {
  search: string;
  customerId: string;
  salesmanId: string;
  status: string;
  paymentStatus: string;
  dateFrom: string;
  dateTo: string;
}) {
  const where: Prisma.SaleWhereInput = {};

  if (params.search) {
    where.OR = [
      {
        invoiceNumber: {
          contains: params.search,
          mode: "insensitive",
        },
      },
      {
        notes: {
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
        customer: {
          address: {
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
    ];
  }

  if (params.customerId) {
    where.customerId = params.customerId;
  }

  if (params.salesmanId) {
    where.salesmanId = params.salesmanId;
  }

  if (
    params.status === "DRAFT" ||
    params.status === "POSTED" ||
    params.status === "CANCELLED"
  ) {
    where.status = params.status;
  }

  if (
    params.paymentStatus === "UNPAID" ||
    params.paymentStatus === "PARTIAL" ||
    params.paymentStatus === "PAID"
  ) {
    where.paymentStatus = params.paymentStatus;
  }

  if (params.dateFrom || params.dateTo) {
    where.saleDate = {};

    if (params.dateFrom) {
      where.saleDate.gte = new Date(`${params.dateFrom}T00:00:00`);
    }

    if (params.dateTo) {
      where.saleDate.lte = new Date(`${params.dateTo}T23:59:59.999`);
    }
  }

  return where;
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

async function createSalesInvoiceWorkbook(params: {
  items: SalesInvoiceExportItem[];
  dateFrom: string;
  dateTo: string;
}) {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Sparepart Warehouse";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Sales Invoices", {
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
    { key: "no", width: 6 },
    { key: "invoiceNumber", width: 24 },
    { key: "saleDate", width: 14 },
    { key: "dueDate", width: 14 },
    { key: "customer", width: 42 },
    { key: "salesman", width: 22 },
    { key: "status", width: 14 },
    { key: "paymentStatus", width: 16 },
    { key: "totalAmount", width: 18 },
    { key: "paidAmount", width: 18 },
    { key: "remainingAmount", width: 18 },
    { key: "totalItems", width: 12 },
    { key: "totalPayments", width: 14 },
    { key: "createdBy", width: 20 },
    { key: "createdAt", width: 20 },
  ];

  worksheet.mergeCells("A1:O1");
  worksheet.mergeCells("A2:O2");

  worksheet.getCell("A1").value = "Laporan Sales Invoices";
  worksheet.getCell("A2").value =
    params.dateFrom || params.dateTo
      ? `Periode ${params.dateFrom || "-"} s/d ${params.dateTo || "-"}`
      : "Semua Periode";

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

  const totalSales = params.items.reduce(
    (sum, item) => sum + toNumber(item.totalAmount),
    0,
  );

  const totalPaid = params.items.reduce(
    (sum, item) => sum + toNumber(item.paidAmount),
    0,
  );

  const totalRemaining = params.items.reduce(
    (sum, item) => sum + toNumber(item.remainingAmount),
    0,
  );

  worksheet.getCell("A4").value = "Total Invoices";
  worksheet.getCell("B4").value = totalInvoices;

  worksheet.getCell("D4").value = "Total Sales";
  worksheet.getCell("E4").value = totalSales;

  worksheet.getCell("G4").value = "Total Paid";
  worksheet.getCell("H4").value = totalPaid;

  worksheet.getCell("J4").value = "Total Receivable";
  worksheet.getCell("K4").value = totalRemaining;

  ["A4", "D4", "G4", "J4"].forEach((cellAddress) => {
    worksheet.getCell(cellAddress).font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FF475569" },
    };
  });

  ["B4", "E4", "H4", "K4"].forEach((cellAddress) => {
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

  const headerRowNumber = 6;
  const headerRow = worksheet.getRow(headerRowNumber);

  headerRow.values = [
    "No",
    "Invoice",
    "Sale Date",
    "Due Date",
    "Customer",
    "Salesman",
    "Status",
    "Payment",
    "Total",
    "Paid",
    "Remaining",
    "Items",
    "Payments",
    "Created By",
    "Created At",
  ];

  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF1E3A8A",
      },
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
      formatCustomerNameAddress(item.customer),
      item.salesman?.name || "-",
      item.status,
      item.paymentStatus,
      toNumber(item.totalAmount),
      toNumber(item.paidAmount),
      toNumber(item.remainingAmount),
      item._count?.items || 0,
      item._count?.payments || 0,
      item.createdBy?.fullName || item.createdBy?.username || "-",
      formatDateTime(item.createdAt),
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
          colNumber === 7 ||
          colNumber === 8 ||
          colNumber === 12 ||
          colNumber === 13
            ? "center"
            : colNumber >= 9 && colNumber <= 11
              ? "right"
              : "left",
      };

      applyThinBorder(cell);

      if (index % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFF8FAFC",
          },
        };
      }
    });

    row.getCell(9).numFmt = '"Rp" #,##0';
    row.getCell(10).numFmt = '"Rp" #,##0';
    row.getCell(11).numFmt = '"Rp" #,##0';

    if (item.status === "CANCELLED") {
      row.getCell(7).font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "FFDC2626" },
      };
    }

    if (item.paymentStatus === "UNPAID") {
      row.getCell(8).font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "FFEA580C" },
      };
    }

    if (item.paymentStatus === "PARTIAL") {
      row.getCell(8).font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "FF2563EB" },
      };
    }

    if (item.paymentStatus === "PAID") {
      row.getCell(8).font = {
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
    "",
    totalSales,
    totalPaid,
    totalRemaining,
    "",
    "",
    "",
    "",
  ];

  worksheet.mergeCells(`B${totalRowNumber}:H${totalRowNumber}`);

  totalRow.height = 24;

  totalRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: {
        argb: "FF0F172A",
      },
    };

    cell.alignment = {
      horizontal: colNumber >= 9 && colNumber <= 11 ? "right" : "center",
      vertical: "middle",
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFE0F2FE",
      },
    };

    applyThinBorder(cell);
  });

  totalRow.getCell(9).numFmt = '"Rp" #,##0';
  totalRow.getCell(10).numFmt = '"Rp" #,##0';
  totalRow.getCell(11).numFmt = '"Rp" #,##0';

  worksheet.autoFilter = {
    from: {
      row: headerRowNumber,
      column: 1,
    },
    to: {
      row: headerRowNumber,
      column: 15,
    },
  };

  const buffer = await workbook.xlsx.writeBuffer();

  return buffer;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const exportType = (searchParams.get("export") || "").trim();

    const auth = await requirePermission("sales.view");

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
    const status = (searchParams.get("status") || "").trim();
    const paymentStatus = (searchParams.get("paymentStatus") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = Number.isNaN(limit) || limit < 1 ? 10 : limit;
    const skip = (safePage - 1) * safeLimit;

    const where = buildSaleWhere({
      search,
      customerId,
      salesmanId,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
    });

    if (exportType === "xlsx") {
      const items = await prisma.sale.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              address: true,
              customerType: true,
            },
          },
          salesman: {
            select: {
              id: true,
              code: true,
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
        orderBy: getSaleOrderBy(sortBy, sortOrder),
      });

      const buffer = await createSalesInvoiceWorkbook({
        items,
        dateFrom,
        dateTo,
      });

      return createExcelResponse({
        buffer,
        filename: `sales-invoices-${formatDateForFile()}.xlsx`,
      });
    }

    const [items, total] = await prisma.$transaction([
      prisma.sale.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              address: true,
              customerType: true,
            },
          },
          salesman: {
            select: {
              id: true,
              code: true,
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
        orderBy: getSaleOrderBy(sortBy, sortOrder),
        skip,
        take: safeLimit,
      }),

      prisma.sale.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Sales retrieved successfully",
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
    console.error("GET /api/sales error:", error);

    return errorResponse({
      message: error instanceof Error ? error.message : "Failed to fetch sales",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("sales.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;
    const body = (await req.json()) as CreateSaleBody;

    const customerId = nullableId(body.customerId);
    const salesmanId = nullableId(body.salesmanId);
    const saleDate = parseDate(body.saleDate);
    const dueDate = parseNullableDate(body.dueDate);
    const notes = body.notes?.trim() || null;
    const paidAmountInput = parseDecimal(body.paidAmount, 0);

    const items = body.items || [];

    if (items.length === 0) {
      return errorResponse({
        message: "Minimal harus ada 1 item penjualan",
        status: 400,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // let invoiceNumber = body.invoiceNumber?.trim().toUpperCase() || "";

      // if (!invoiceNumber) {
      //   invoiceNumber = await generateInvoiceNumber(tx);
      // }

      const invoiceNumber = await generateInvoiceNumber(tx);

      const duplicateInvoice = await tx.sale.findUnique({
        where: {
          invoiceNumber,
        },
        select: {
          id: true,
        },
      });

      if (duplicateInvoice) {
        throw new Error("Nomor invoice sudah digunakan");
      }

      if (customerId) {
        const customer = await tx.customer.findUnique({
          where: {
            id: customerId,
          },
          select: {
            id: true,
          },
        });

        if (!customer) {
          throw new Error("Customer tidak ditemukan");
        }
      }

      if (salesmanId) {
        const salesman = await tx.salesman.findUnique({
          where: {
            id: salesmanId,
          },
          select: {
            id: true,
          },
        });

        if (!salesman) {
          throw new Error("Salesman tidak ditemukan");
        }
      }

      const normalizedItems = items.map((item, index) => {
        const productId = item.productId?.trim();
        const warehouseId = nullableId(item.warehouseId);
        const rackLocationId = nullableId(item.rackLocationId);

        const quantity = parseInteger(
          item.quantity,
          `Quantity item ${index + 1}`,
        );

        const unitPrice = parseDecimal(item.unitPrice, 0);
        const discountPercent = parsePercent(item.discountPercent, 0);
        const additionalDiscountPercent = parsePercent(
          item.additionalDiscountPercent,
          0,
        );
        const additionalDiscountPercent2 = parsePercent(
          item.additionalDiscountPercent2,
          0,
        );

        if (!productId) {
          throw new Error(`Product item ${index + 1} wajib dipilih`);
        }

        const { discountAmount, totalPrice } = calculateSaleItemTotal({
          quantity,
          unitPrice,
          discountPercent,
          additionalDiscountPercent,
          additionalDiscountPercent2,
        });

        if (totalPrice < 0) {
          throw new Error(`Total item ${index + 1} tidak boleh minus`);
        }

        return {
          productId,
          warehouseId,
          rackLocationId,
          quantity,
          unitPrice,
          discountPercent,
          discountQty: quantity,
          additionalDiscountPercent,
          additionalDiscountPercent2,
          discountAmount,
          totalPrice,
        };
      });

      /**
       * Gabungkan baris penjualan yang benar-benar identik.
       * Produk yang sama tetapi lokasi, harga, atau diskonnya berbeda
       * tetap disimpan sebagai baris terpisah.
       */
      const mergedItemMap = new Map<string, (typeof normalizedItems)[number]>();

      for (const item of normalizedItems) {
        const key = JSON.stringify([
          item.productId,
          item.warehouseId,
          item.rackLocationId,
          item.unitPrice,
          item.discountPercent,
          item.additionalDiscountPercent,
          item.additionalDiscountPercent2,
        ]);

        const existing = mergedItemMap.get(key);

        if (!existing) {
          mergedItemMap.set(key, { ...item });
          continue;
        }

        existing.quantity += item.quantity;
        existing.discountQty = existing.quantity;

        const recalculated = calculateSaleItemTotal({
          quantity: existing.quantity,
          unitPrice: existing.unitPrice,
          discountPercent: existing.discountPercent,
          additionalDiscountPercent: existing.additionalDiscountPercent,
          additionalDiscountPercent2: existing.additionalDiscountPercent2,
        });

        existing.discountAmount = recalculated.discountAmount;
        existing.totalPrice = recalculated.totalPrice;
      }

      const mergedItems = Array.from(mergedItemMap.values());

      const subtotal = mergedItems.reduce(
        (total, item) => total + item.quantity * item.unitPrice,
        0,
      );

      const totalDiscountAmount = mergedItems.reduce(
        (total, item) => total + item.discountAmount,
        0,
      );

      const totalAmount = mergedItems.reduce(
        (total, item) => total + item.totalPrice,
        0,
      );

      if (totalAmount < 0) {
        throw new Error("Total penjualan tidak boleh minus");
      }

      if (paidAmountInput > totalAmount) {
        throw new Error(
          "Nominal pembayaran tidak boleh lebih besar dari total",
        );
      }

      const remainingAmount = totalAmount - paidAmountInput;
      const paymentStatus = getPaymentStatus(totalAmount, paidAmountInput);

      const sale = await tx.sale.create({
        data: {
          customerId,
          salesmanId,
          invoiceNumber,
          saleDate,
          status: "POSTED",
          paymentStatus,
          subtotal,
          discountAmount: totalDiscountAmount,
          totalAmount,
          paidAmount: paidAmountInput,
          remainingAmount,
          dueDate,
          notes,
          createdById: currentUser.id,
          postedAt: new Date(),
        },
      });

      for (const item of mergedItems) {
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

        if (product.currentStock < item.quantity) {
          throw new Error(
            `Stock product "${product.name}" tidak cukup. Tersedia: ${product.currentStock}`,
          );
        }

        if (item.warehouseId) {
          const warehouse = await tx.warehouse.findUnique({
            where: {
              id: item.warehouseId,
            },
            select: {
              id: true,
            },
          });

          if (!warehouse) {
            throw new Error("Warehouse tidak ditemukan");
          }
        }

        if (item.rackLocationId) {
          const rackLocation = await tx.rackLocation.findUnique({
            where: {
              id: item.rackLocationId,
            },
            select: {
              id: true,
              warehouseId: true,
            },
          });

          if (!rackLocation) {
            throw new Error("Rack location tidak ditemukan");
          }

          if (
            item.warehouseId &&
            rackLocation.warehouseId !== item.warehouseId
          ) {
            throw new Error("Rack location tidak sesuai dengan warehouse");
          }
        }

        const stockBefore = product.currentStock;
        const stockAfter = stockBefore - item.quantity;

        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            warehouseId: item.warehouseId,
            rackLocationId: item.rackLocationId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            discountQty: item.discountQty,
            additionalDiscountPercent: item.additionalDiscountPercent,
            additionalDiscountPercent2: item.additionalDiscountPercent2,
            discountAmount: item.discountAmount,
            totalPrice: item.totalPrice,
          },
        });

        await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            currentStock: {
              decrement: item.quantity,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: item.warehouseId,
            rackLocationId: item.rackLocationId,
            type: "OUT",
            quantity: item.quantity,
            stockBefore,
            stockAfter,
            referenceType: "SALE",
            referenceId: sale.id,
            notes: `Penjualan ${invoiceNumber}`,
            createdById: currentUser.id,
          },
        });
      }

      if (paidAmountInput > 0) {
        await tx.salePayment.create({
          data: {
            saleId: sale.id,
            paymentDate: saleDate,
            amount: paidAmountInput,
            method: "CASH",
            referenceNumber: null,
            notes: "Pembayaran awal saat penjualan",
            createdById: currentUser.id,
          },
        });
      }

      return tx.sale.findUnique({
        where: {
          id: sale.id,
        },
        include: {
          customer: true,
          salesman: true,
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
        message: "Gagal membuat penjualan",
        status: 500,
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        module: "sales",
        resourceType: "sales",
        resourceId: result.id,
        oldData: Prisma.JsonNull,
        newData: result,
      },
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "CREATE",
      module: "sales",
      relatedId: result.id,
      title: "Sale Created",
      message: `${currentUser.name || "Someone"} created sale ${
        result.invoiceNumber
      }.`,
    });

    return successResponse({
      message: "Sale created successfully",
      data: result,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/sales error:", error);

    return errorResponse({
      message: error instanceof Error ? error.message : "Failed to create sale",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
