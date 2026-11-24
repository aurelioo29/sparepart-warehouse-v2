import ExcelJS from "exceljs";

import { Prisma, SalePaymentMethod } from "@/../prisma/generated/prisma/client";

import { errorResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Memeriksa apakah nilai dari query parameter merupakan
 * enum metode pembayaran yang valid dari Prisma.
 */
function isSalePaymentMethod(value: string): value is SalePaymentMethod {
  return Object.values(SalePaymentMethod).includes(value as SalePaymentMethod);
}

/**
 * Mengubah tanggal YYYY-MM-DD menjadi Date berdasarkan WIB.
 */
function parseWibDate(value: string, endOfDay = false): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const validationDate = new Date(Date.UTC(year, month - 1, day));

  if (
    validationDate.getUTCFullYear() !== year ||
    validationDate.getUTCMonth() !== month - 1 ||
    validationDate.getUTCDate() !== day
  ) {
    return null;
  }

  const time = endOfDay ? "23:59:59.999" : "00:00:00.000";

  return new Date(`${value}T${time}+07:00`);
}

/**
 * Menampilkan Date menjadi DD/MM/YYYY berdasarkan WIB.
 */
function formatWibDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Menentukan nama file berdasarkan rentang tanggal.
 */
function getFilename(dateFrom: string, dateTo: string): string {
  const base = "laporan-pembayaran-sales";

  if (!dateFrom && !dateTo) {
    return `${base}.xlsx`;
  }

  if (dateFrom && dateTo && dateFrom.slice(0, 7) === dateTo.slice(0, 7)) {
    return `${base}-${dateFrom.slice(0, 7)}.xlsx`;
  }

  if (dateFrom && dateTo) {
    return `${base}-${dateFrom}_${dateTo}.xlsx`;
  }

  return `${base}-${dateFrom || dateTo}.xlsx`;
}

/**
 * Memberikan border pada cell Excel.
 */
function applyBorder(cell: ExcelJS.Cell): void {
  cell.border = {
    top: {
      style: "thin",
      color: { argb: "FF000000" },
    },
    left: {
      style: "thin",
      color: { argb: "FF000000" },
    },
    bottom: {
      style: "thin",
      color: { argb: "FF000000" },
    },
    right: {
      style: "thin",
      color: { argb: "FF000000" },
    },
  };
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

    const search = (searchParams.get("search") ?? "").trim();
    const saleId = (searchParams.get("saleId") ?? "").trim();
    const methodParam = (searchParams.get("method") ?? "").trim();
    const dateFrom = (searchParams.get("dateFrom") ?? "").trim();
    const dateTo = (searchParams.get("dateTo") ?? "").trim();

    /**
     * methodParam masih bertipe string karena berasal dari URL.
     * Setelah divalidasi, method akan bertipe SalePaymentMethod.
     */
    let method: SalePaymentMethod | undefined;

    if (methodParam) {
      if (!isSalePaymentMethod(methodParam)) {
        return errorResponse({
          message: "Metode pembayaran tidak valid",
          status: 400,
        });
      }

      method = methodParam;
    }

    const startDate = dateFrom ? parseWibDate(dateFrom) : null;

    const endDate = dateTo ? parseWibDate(dateTo, true) : null;

    if ((dateFrom && !startDate) || (dateTo && !endDate)) {
      return errorResponse({
        message: "Tanggal harus valid dengan format YYYY-MM-DD",
        status: 400,
      });
    }

    if (startDate && endDate && startDate > endDate) {
      return errorResponse({
        message: "Tanggal awal tidak boleh melewati tanggal akhir",
        status: 400,
      });
    }

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

    /**
     * method sudah bertipe SalePaymentMethod.
     * Ini merupakan bagian yang memperbaiki error TypeScript sebelumnya.
     */
    if (method !== undefined) {
      where.method = method;
    }

    if (startDate || endDate) {
      where.paymentDate = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const payments = await prisma.salePayment.findMany({
      where,
      select: {
        id: true,
        paymentDate: true,
        amount: true,
        method: true,
        sale: {
          select: {
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          paymentDate: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Sparepart Warehouse";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Laporan Pembayaran Sales", {
      pageSetup: {
        paperSize: 9,
        orientation: "portrait",
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
      {
        key: "no",
        width: 7,
      },
      {
        key: "customerName",
        width: 36,
      },
      {
        key: "paymentDate",
        width: 21,
      },
      {
        key: "amount",
        width: 25,
      },
      {
        key: "method",
        width: 25,
      },
    ];

    // =====================================================
    // JUDUL
    // =====================================================

    worksheet.mergeCells("A1:E1");

    const titleCell = worksheet.getCell("A1");

    titleCell.value = "Laporan Pembayaran Sales";
    titleCell.font = {
      name: "Times New Roman",
      size: 14,
      bold: true,
    };
    titleCell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    worksheet.getRow(1).height = 28;

    // Jarak antara judul dan tabel.
    worksheet.getRow(2).height = 8;

    // =====================================================
    // HEADER
    // =====================================================

    const headerRow = worksheet.getRow(3);

    headerRow.values = [
      "No",
      "Nama Toko",
      "Tanggal Bayar",
      "Nominal Bayar",
      "Metode Pembayaran",
    ];

    headerRow.height = 26;

    for (let column = 1; column <= 5; column += 1) {
      const cell = headerRow.getCell(column);

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

      applyBorder(cell);
    }

    // =====================================================
    // DATA PEMBAYARAN
    // =====================================================

    payments.forEach((payment, index) => {
      const rowNumber = index + 4;
      const row = worksheet.getRow(rowNumber);

      row.values = [
        index + 1,
        payment.sale.customer?.name || "-",
        formatWibDate(payment.paymentDate),
        payment.amount.toNumber(),
        payment.method,
      ];

      row.height = 25;

      for (let column = 1; column <= 5; column += 1) {
        const cell = row.getCell(column);

        cell.font = {
          name: "Times New Roman",
          size: 12,
        };

        cell.alignment = {
          horizontal:
            column === 1 || column === 3 || column === 5
              ? "center"
              : column === 4
                ? "right"
                : "left",
          vertical: "middle",
          wrapText: column === 2,
        };

        applyBorder(cell);
      }

      row.getCell(4).numFmt = '"Rp" #,##0.00';
    });

    // =====================================================
    // TOTAL
    // =====================================================

    const totalAmount = payments.reduce(
      (sum, payment) => sum + payment.amount.toNumber(),
      0,
    );

    const totalRowNumber = payments.length + 4;
    const totalRow = worksheet.getRow(totalRowNumber);

    worksheet.mergeCells(`A${totalRowNumber}:C${totalRowNumber}`);

    totalRow.getCell(1).value = "TOTAL";
    totalRow.getCell(4).value = totalAmount;
    totalRow.getCell(4).numFmt = '"Rp" #,##0.00';
    totalRow.getCell(5).value = "";

    totalRow.height = 26;

    for (let column = 1; column <= 5; column += 1) {
      const cell = totalRow.getCell(column);

      cell.font = {
        name: "Times New Roman",
        size: 12,
        bold: true,
      };

      cell.alignment = {
        horizontal: column === 4 ? "right" : "center",
        vertical: "middle",
      };

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: column === 4 ? "FFB59B00" : "FFFFFFFF",
        },
      };

      applyBorder(cell);
    }

    // =====================================================
    // PENGATURAN WORKSHEET
    // =====================================================

    worksheet.views = [
      {
        state: "normal",
        showGridLines: false,
      },
    ];

    worksheet.autoFilter = {
      from: "A3",
      to: "E3",
    };

    worksheet.pageSetup.printArea = `A1:E${totalRowNumber}`;
    worksheet.pageSetup.printTitlesRow = "1:3";

    // =====================================================
    // RESPONSE DOWNLOAD
    // =====================================================

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${getFilename(
          dateFrom,
          dateTo,
        )}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/sale-payments/export error:", error);

    return errorResponse({
      message: "Gagal mengekspor laporan pembayaran sales",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
