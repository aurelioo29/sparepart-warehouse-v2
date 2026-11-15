import { Prisma } from "@/../prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import ExcelJS from "exceljs";
import {
  createPostedSalesWhere,
  getSaleDateParts,
  getSalesMonthRange,
  getSalesMonthSpan,
  getWibDateParts,
} from "@/lib/sales-report-filters";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type SortBy =
  | "salesmanName"
  | "salesmanType"
  | "totalInvoices"
  | "totalSales"
  | "totalPaid"
  | "totalReceivable"
  | "estimatedCommission";
type SortOrder = "asc" | "desc";
type ExportFormat = "salesman-recap" | "kng-sales-report";
type SalesmanReportRow = {
  salesmanId: string;
  salesmanName: string;
  salesmanType: string;
  commissionType: string;
  commissionValue: number;
  totalInvoices: number;
  totalSales: number;
  totalPaid: number;
  totalReceivable: number;
  estimatedCommission: number;
};
type KngSalesReportRow = {
  customerId: string;
  customerName: string;
  customerAddress: string;
  salesmanName: string;
  monthlyTotals: Record<string, number>;
};
type KngReportMonth = {
  key: string;
  label: string;
};
const validSortBy: SortBy[] = [
  "salesmanName",
  "salesmanType",
  "totalInvoices",
  "totalSales",
  "totalPaid",
  "totalReceivable",
  "estimatedCommission",
];
const monthNamesId = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
function formatDateForFile() {
  const { year, month, day } = getWibDateParts();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function formatDatePart(date: Date) {
  const { year, month, day } = getSaleDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function formatDateDisplay(date: Date) {
  const { year, month, day } = getSaleDateParts(date);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}
function formatNumberId(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
function formatRupiahText(value: number) {
  if (!value) return "";
  return formatNumberId(value);
}
function getMonthRange(year: number, month: number) {
  const { start, endExclusive } = getSalesMonthRange(year, month);
  return { start, end: new Date(endExclusive.getTime() - 1) };
}
// One shared status/date filter for the recap, KNG export and dashboard.
function getSalePeriodFilter(start: Date, end: Date, salesmanId?: string) {
  return createPostedSalesWhere(
    { start, endExclusive: new Date(end.getTime() + 1) },
    salesmanId,
  );
}
function normalizeSortBy(value: string): SortBy {
  if (validSortBy.includes(value as SortBy)) {
    return value as SortBy;
  }
  return "totalSales";
}
function normalizeSortOrder(value: string): SortOrder {
  return value === "asc" ? "asc" : "desc";
}
function normalizeExportFormat(value: string): ExportFormat {
  if (value === "kng-sales-report") return "kng-sales-report";
  return "salesman-recap";
}
function compareString(a: string, b: string, sortOrder: SortOrder) {
  const result = a.localeCompare(b);
  return sortOrder === "asc" ? result : -result;
}
function compareNumber(a: number, b: number, sortOrder: SortOrder) {
  const result = a - b;
  return sortOrder === "asc" ? result : -result;
}
function sortRows(
  rows: SalesmanReportRow[],
  sortBy: SortBy,
  sortOrder: SortOrder,
) {
  return [...rows].sort((a, b) => {
    if (sortBy === "salesmanName") {
      return compareString(a.salesmanName, b.salesmanName, sortOrder);
    }
    if (sortBy === "salesmanType") {
      return compareString(a.salesmanType, b.salesmanType, sortOrder);
    }
    return compareNumber(
      Number(a[sortBy] || 0),
      Number(b[sortBy] || 0),
      sortOrder,
    );
  });
}
function getPeriodFileLabel(start: Date, end: Date) {
  return `${formatDatePart(start)}_${formatDatePart(end)}`;
}
function getReportTitle(start: Date) {
  return `Laporan Penjualan Persalesman Bulan ${getMonthLabel(start)}`;
}
function getReportSubtitle(start: Date, end: Date) {
  return `Per Periode ${formatDateDisplay(start)} - ${formatDateDisplay(end)}`;
}
function getMonthLabel(date: Date) {
  const { year, month } = getSaleDateParts(date);
  return `${monthNamesId[month - 1]} ${year}`;
}
function getMonthKey(date: Date) {
  const { year, month } = getSaleDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}
function getMonthsInRange(start: Date, end: Date): KngReportMonth[] {
  const first = getSaleDateParts(start);
  const last = getSaleDateParts(end);
  const months: KngReportMonth[] = [];
  for (
    let index = first.year * 12 + first.month - 1;
    index <= last.year * 12 + last.month - 1;
    index += 1
  ) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    months.push({
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: `${monthNamesId[month - 1]} ${year}`,
    });
  }
  return months;
}
function applyThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
}
function applyMediumOuterBorder(params: {
  worksheet: ExcelJS.Worksheet;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}) {
  for (
    let rowNumber = params.startRow;
    rowNumber <= params.endRow;
    rowNumber += 1
  ) {
    for (
      let colNumber = params.startCol;
      colNumber <= params.endCol;
      colNumber += 1
    ) {
      const cell = params.worksheet.getCell(rowNumber, colNumber);
      cell.border = {
        top: {
          style: rowNumber === params.startRow ? "medium" : "thin",
        },
        left: {
          style: colNumber === params.startCol ? "medium" : "thin",
        },
        bottom: {
          style: rowNumber === params.endRow ? "medium" : "thin",
        },
        right: {
          style: colNumber === params.endCol ? "medium" : "thin",
        },
      };
    }
  }
}
async function createSalesmanRecapWorkbook(params: {
  rows: SalesmanReportRow[];
  summary: {
    totalSalesmen: number;
    totalInvoices: number;
    totalSales: number;
    totalPaid: number;
    totalReceivable: number;
    totalEstimatedCommission: number;
  };
  start: Date;
  end: Date;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sparepart Warehouse";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Salesman Report", {
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
  worksheet.properties.defaultRowHeight = 22;
  worksheet.columns = [
    { key: "salesmanName", width: 28 },
    { key: "salesmanType", width: 18 },
    { key: "totalInvoices", width: 16 },
    { key: "totalSales", width: 22 },
    { key: "totalReceivable", width: 24 },
  ];
  worksheet.mergeCells("A1:E1");
  worksheet.mergeCells("A2:E2");
  worksheet.getCell("A1").value = getReportTitle(params.start);
  worksheet.getCell("A2").value = getReportSubtitle(params.start, params.end);
  worksheet.getRow(1).height = 26;
  worksheet.getRow(2).height = 24;
  ["A1", "A2"].forEach((cellAddress) => {
    const cell = worksheet.getCell(cellAddress);
    cell.font = {
      name: "Times New Roman",
      size: 14,
      bold: true,
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };
  });
  const headerRowNumber = 4;
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.values = [
    "Salesman Name",
    "Type",
    "Total Invoices",
    "Total Sales",
    "Total Receivable",
  ];
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: "Times New Roman",
      size: 14,
      bold: true,
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFD9D9D9",
      },
    };
    applyThinBorder(cell);
  });
  let currentRowNumber = headerRowNumber + 1;
  for (const item of params.rows) {
    const row = worksheet.getRow(currentRowNumber);
    row.values = [
      item.salesmanName,
      item.salesmanType,
      item.totalInvoices,
      formatRupiahText(item.totalSales),
      formatRupiahText(item.totalReceivable),
    ];
    row.height = 23;
    row.eachCell((cell, colNumber) => {
      cell.font = {
        name: "Times New Roman",
        size: 14,
      };
      cell.alignment = {
        horizontal:
          colNumber === 3 || colNumber === 4 || colNumber === 5
            ? "right"
            : "left",
        vertical: "middle",
      };
      applyThinBorder(cell);
    });
    currentRowNumber += 1;
  }
  const totalRow = worksheet.getRow(currentRowNumber);
  totalRow.values = [
    "Total",
    "",
    params.summary.totalInvoices,
    formatRupiahText(params.summary.totalSales),
    formatRupiahText(params.summary.totalReceivable),
  ];
  totalRow.height = 24;
  worksheet.mergeCells(`A${currentRowNumber}:B${currentRowNumber}`);
  totalRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: "Times New Roman",
      size: 14,
      bold: true,
      color: {
        argb: "FF9C1C1C",
      },
    };
    cell.alignment = {
      horizontal: colNumber === 1 ? "center" : "right",
      vertical: "middle",
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFF2F2F2",
      },
    };
    applyThinBorder(cell);
  });
  applyMediumOuterBorder({
    worksheet,
    startRow: headerRowNumber,
    endRow: currentRowNumber,
    startCol: 1,
    endCol: 5,
  });
  worksheet.views = [
    {
      state: "normal",
      showGridLines: false,
    },
  ];
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
async function createKngSalesReportWorkbook(params: {
  rows: KngSalesReportRow[];
  months: KngReportMonth[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sparepart Warehouse";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Laporan Penjualan KNG", {
    pageSetup: {
      paperSize: 9,
      orientation: params.months.length > 2 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.35,
        bottom: 0.35,
        header: 0.2,
        footer: 0.2,
      },
    },
  });
  worksheet.properties.defaultRowHeight = 22;
  worksheet.columns = [
    { key: "no", width: 6 },
    { key: "customerName", width: 34 },
    { key: "customerAddress", width: 42 },
    { key: "salesmanName", width: 18 },
    ...params.months.map((month) => ({
      key: month.key,
      width: 18,
    })),
  ];
  const lastColumnNumber = 4 + params.months.length;
  worksheet.mergeCells(1, 1, 1, lastColumnNumber);
  worksheet.getCell("A1").value = "Laporan Penjualan KNG";
  worksheet.getRow(1).height = 28;
  worksheet.getCell("A1").font = {
    name: "Times New Roman",
    size: 14,
    bold: true,
  };
  worksheet.getCell("A1").alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  const headerRowNumber = 3;
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.values = [
    "No",
    "Nama Toko",
    "Alamat Toko",
    "Sales / Ket",
    ...params.months.map((month) => month.label),
  ];
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: "Times New Roman",
      size: 14,
      bold: true,
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFB59B00",
      },
    };
    applyThinBorder(cell);
  });
  const sortedRows = [...params.rows].sort((a, b) => {
    const salesCompare = a.salesmanName.localeCompare(b.salesmanName);
    if (salesCompare !== 0) return salesCompare;
    return a.customerName.localeCompare(b.customerName);
  });
  let currentRowNumber = headerRowNumber + 1;
  sortedRows.forEach((item, index) => {
    const row = worksheet.getRow(currentRowNumber);
    row.values = [
      index + 1,
      item.customerName,
      item.customerAddress,
      item.salesmanName,
      ...params.months.map((month) =>
        formatRupiahText(item.monthlyTotals[month.key] || 0),
      ),
    ];
    row.height = 36;
    row.eachCell((cell, colNumber) => {
      cell.font = {
        name: "Times New Roman",
        size: 14,
      };
      cell.alignment = {
        horizontal:
          colNumber === 1 ? "center" : colNumber >= 5 ? "right" : "left",
        vertical: "middle",
        wrapText: colNumber === 2 || colNumber === 3,
      };
      applyThinBorder(cell);
    });
    currentRowNumber += 1;
  });
  /**
   * Merge kolom Sales / Ket kalau salesman berurutan sama.
   * Ini supaya bentuknya mirip contoh laporan manual yang kamu kirim.
   */
  if (sortedRows.length > 0) {
    let groupStartRow = headerRowNumber + 1;
    let activeSalesman = sortedRows[0].salesmanName;
    for (let index = 1; index <= sortedRows.length; index += 1) {
      const currentSalesman = sortedRows[index]?.salesmanName;
      const isGroupEnd = currentSalesman !== activeSalesman;
      if (isGroupEnd) {
        const groupEndRow = headerRowNumber + index;
        if (groupEndRow > groupStartRow) {
          worksheet.mergeCells(`D${groupStartRow}:D${groupEndRow}`);
          worksheet.getCell(`D${groupStartRow}`).alignment = {
            horizontal: "center",
            vertical: "middle",
          };
        }
        groupStartRow = headerRowNumber + index + 1;
        activeSalesman = currentSalesman || "";
      }
    }
  }
  const totalsByMonth = params.months.map((month) =>
    sortedRows.reduce(
      (sum, item) => sum + (item.monthlyTotals[month.key] || 0),
      0,
    ),
  );
  const totalRowNumber = currentRowNumber;
  const totalRow = worksheet.getRow(totalRowNumber);
  totalRow.values = [
    "",
    "Total",
    "",
    "",
    ...totalsByMonth.map((total) => formatRupiahText(total)),
  ];
  totalRow.height = 24;
  worksheet.mergeCells(`A${totalRowNumber}:D${totalRowNumber}`);
  totalRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: "Times New Roman",
      size: 14,
      bold: true,
    };
    cell.alignment = {
      horizontal: colNumber === 1 ? "center" : "right",
      vertical: "middle",
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: colNumber >= 5 ? "FFB59B00" : "FFFFFFFF",
      },
    };
    applyThinBorder(cell);
  });
  applyMediumOuterBorder({
    worksheet,
    startRow: headerRowNumber,
    endRow: totalRowNumber,
    startCol: 1,
    endCol: lastColumnNumber,
  });
  worksheet.views = [
    {
      state: "normal",
      showGridLines: false,
    },
  ];
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
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
async function buildKngSalesReportRows(params: {
  salesmanId: string;
  start: Date;
  end: Date;
}) {
  const months = getMonthsInRange(params.start, params.end);
  const sales = await prisma.sale.findMany({
    where: getSalePeriodFilter(params.start, params.end, params.salesmanId),
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          address: true,
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
        salesman: {
          name: "asc",
        },
      },
      {
        customer: {
          name: "asc",
        },
      },
    ],
  });
  const map = new Map<string, KngSalesReportRow>();
  for (const sale of sales) {
    const customerId = sale.customer?.id || "WALK_IN";
    const customerName = sale.customer?.name || "Walk-in Customer";
    const customerAddress = sale.customer?.address?.trim() || "-";
    const salesmanKey = sale.salesman?.id || "NO_SALESMAN";
    const key = `${customerId}:${salesmanKey}`;
    const saleDate = new Date(sale.saleDate);
    const monthKey = getMonthKey(saleDate);
    const existing = map.get(key) || {
      customerId,
      customerName,
      customerAddress,
      salesmanName: sale.salesman?.name || "-",
      monthlyTotals: {},
    };
    if (sale.salesman?.name) {
      existing.salesmanName = sale.salesman.name;
    }
    existing.monthlyTotals[monthKey] =
      (existing.monthlyTotals[monthKey] || 0) + Number(sale.totalAmount || 0);
    map.set(key, existing);
  }
  // Every queried sale is already in the selected period.
  // Preserve zero/negative customer totals so both exports reconcile.
  const rows = Array.from(map.values());
  return {
    rows,
    months,
  };
}
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const exportType = (searchParams.get("export") || "").trim();
    const exportFormat = normalizeExportFormat(
      (searchParams.get("exportFormat") || "salesman-recap").trim(),
    );
    const auth = await requirePermission(
      exportType === "xlsx"
        ? "reports.salesman.export"
        : "reports.salesman.view",
    );
    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }
    const now = getWibDateParts();
    const year = Number(searchParams.get("year") || now.year);
    const month = Number(searchParams.get("month") || now.month);
    const salesmanId = (searchParams.get("salesmanId") || "").trim();
    // This is a monthly report: year/month always determine the period.
    // Legacy dateFrom/dateTo parameters do not override the selected month.
    const sortBy = normalizeSortBy(
      (searchParams.get("sortBy") || "totalSales").trim(),
    );
    const sortOrder = normalizeSortOrder(
      (searchParams.get("sortOrder") || "desc").trim(),
    );
    if (!Number.isInteger(year) || year < 2000 || year > 9998) {
      return errorResponse({
        message: "Year tidak valid",
        status: 400,
      });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return errorResponse({
        message: "Month tidak valid",
        status: 400,
      });
    }
    const { start, end } = getMonthRange(year, month);
    const mode = "month";
    /**
     * Export format kedua:
     * Laporan Penjualan KNG
     *
     * Bentuknya:
     * No | Nama Toko | Sales / Ket | Kolom bulan dinamis sesuai periode
     */
    if (exportType === "xlsx" && exportFormat === "kng-sales-report") {
      const monthFrom = (searchParams.get("monthFrom") || "").trim();
      const monthTo = (searchParams.get("monthTo") || "").trim();
      let kngStart = start;
      let kngEnd = end;
      if (monthFrom || monthTo) {
        if (!monthFrom || !monthTo) {
          return errorResponse({
            message: "Bulan awal dan akhir KNG wajib diisi",
            status: 400,
          });
        }
        try {
          const range = getSalesMonthSpan(monthFrom, monthTo);
          kngStart = range.start;
          kngEnd = new Date(range.endExclusive.getTime() - 1);
        } catch (error) {
          return errorResponse({
            message:
              error instanceof Error
                ? error.message
                : "Periode KNG tidak valid",
            status: 400,
          });
        }
      }
      const kngReport = await buildKngSalesReportRows({
        salesmanId,
        start: kngStart,
        end: kngEnd,
      });
      const buffer = await createKngSalesReportWorkbook({
        rows: kngReport.rows,
        months: kngReport.months,
      });
      const filename = `laporan-penjualan-kng-${formatDatePart(
        kngStart,
      )}-${formatDatePart(kngEnd)}-${formatDateForFile()}.xlsx`;
      return createExcelResponse({
        buffer,
        filename,
      });
    }
    const where: Prisma.SaleWhereInput = getSalePeriodFilter(
      start,
      end,
      salesmanId,
    );
    const sales = await prisma.sale.findMany({
      where,
      include: {
        salesman: {
          select: {
            id: true,
            name: true,
            salesmanType: true,
            commissionType: true,
            commissionValue: true,
          },
        },
      },
      orderBy: {
        saleDate: "asc",
      },
    });
    const recapMap = new Map<string, SalesmanReportRow>();
    for (const sale of sales) {
      const key = sale.salesman?.id || "NO_SALESMAN";
      const commissionType = sale.salesman?.commissionType || "NONE";
      const commissionValue = Number(sale.salesman?.commissionValue || 0);
      const totalSales = Number(sale.totalAmount || 0);
      const totalPaid = Number(sale.paidAmount || 0);
      const totalReceivable = Number(sale.remainingAmount || 0);
      const existing = recapMap.get(key) || {
        salesmanId: sale.salesman?.id || "",
        salesmanName: sale.salesman?.name || "No Salesman",
        salesmanType: sale.salesman?.salesmanType || "-",
        commissionType,
        commissionValue,
        totalInvoices: 0,
        totalSales: 0,
        totalPaid: 0,
        totalReceivable: 0,
        estimatedCommission: 0,
      };
      let commission = 0;
      if (commissionType === "PERCENTAGE") {
        commission = totalSales * (commissionValue / 100);
      }
      if (commissionType === "FIXED") {
        commission = commissionValue;
      }
      existing.totalInvoices += 1;
      existing.totalSales += totalSales;
      existing.totalPaid += totalPaid;
      existing.totalReceivable += totalReceivable;
      existing.estimatedCommission += commission;
      recapMap.set(key, existing);
    }
    const rows = sortRows(Array.from(recapMap.values()), sortBy, sortOrder);
    const summary = rows.reduce(
      (acc, item) => {
        acc.totalSalesmen += 1;
        acc.totalInvoices += item.totalInvoices;
        acc.totalSales += item.totalSales;
        acc.totalPaid += item.totalPaid;
        acc.totalReceivable += item.totalReceivable;
        acc.totalEstimatedCommission += item.estimatedCommission;
        return acc;
      },
      {
        totalSalesmen: 0,
        totalInvoices: 0,
        totalSales: 0,
        totalPaid: 0,
        totalReceivable: 0,
        totalEstimatedCommission: 0,
      },
    );
    /**
     * Export format pertama:
     * Rekap Persalesman
     */
    if (exportType === "xlsx") {
      const buffer = await createSalesmanRecapWorkbook({
        rows,
        summary,
        start,
        end,
      });
      const filename = `salesman-report-${getPeriodFileLabel(
        start,
        end,
      )}-${formatDateForFile()}.xlsx`;
      return createExcelResponse({
        buffer,
        filename,
      });
    }
    return successResponse({
      message: "Salesman report retrieved successfully",
      data: {
        period: {
          year,
          month,
          mode,
          dateFrom: formatDatePart(start),
          dateTo: formatDatePart(end),
        },
        sort: {
          sortBy,
          sortOrder,
        },
        summary,
        items: rows,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/salesman error:", error);
    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch salesman report",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
