import ExcelJS from "exceljs";
import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const adjustmentReasons = [
  "STOCK_OPNAME",
  "DAMAGED",
  "LOST",
  "FOUND",
  "INPUT_ERROR",
  "OTHER",
] as const;

type AdjustmentReason = (typeof adjustmentReasons)[number];

const reasonLabels: Record<AdjustmentReason, string> = {
  STOCK_OPNAME: "Stock Opname",
  DAMAGED: "Damaged",
  LOST: "Lost",
  FOUND: "Found",
  INPUT_ERROR: "Input Error",
  OTHER: "Other",
};

function isAdjustmentReason(value: string): value is AdjustmentReason {
  return adjustmentReasons.includes(value as AdjustmentReason);
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("stock_adjustments.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { searchParams } = new URL(req.url);

    const search = (searchParams.get("search") || "").trim();

    const reason = (searchParams.get("reason") || "").trim();

    const status = (searchParams.get("status") || "").trim();

    const startDate = (searchParams.get("startDate") || "").trim();

    const endDate = (searchParams.get("endDate") || "").trim();

    if (!startDate || !endDate) {
      return errorResponse({
        message: "Tanggal mulai dan tanggal selesai wajib dipilih",
        status: 400,
      });
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return errorResponse({
        message: "Format tanggal harus YYYY-MM-DD",
        status: 400,
      });
    }

    if (startDate > endDate) {
      return errorResponse({
        message: "Tanggal mulai tidak boleh melebihi tanggal selesai",
        status: 400,
      });
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);

    const endExclusive = new Date(`${endDate}T00:00:00.000Z`);

    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

    const where: Prisma.StockAdjustmentWhereInput = {
      adjustmentDate: {
        gte: start,
        lt: endExclusive,
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
          notes: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          createdBy: {
            OR: [
              {
                fullName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                username: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          },
        },
      ];
    }

    if (reason && isAdjustmentReason(reason)) {
      where.reason = reason;
    }

    if (status === "POSTED" || status === "CANCELLED") {
      where.status = status;
    }

    const adjustments = await prisma.stockAdjustment.findMany({
      where,
      select: {
        id: true,
        documentNumber: true,
        adjustmentDate: true,
        reason: true,
        status: true,
        notes: true,

        items: {
          select: {
            stockBefore: true,
            stockAfter: true,
            difference: true,

            product: {
              select: {
                sku: true,
                name: true,
              },
            },
          },

          orderBy: {
            createdAt: "asc",
          },
        },
      },

      orderBy: [
        {
          adjustmentDate: "asc",
        },
        {
          documentNumber: "asc",
        },
      ],
    });

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Stock Management System";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Stock Adjustments", {
      views: [
        {
          state: "frozen",
          ySplit: 4,
        },
      ],
    });

    worksheet.columns = [
      {
        header: "No.",
        key: "number",
        width: 8,
      },
      {
        header: "Nomor Dokumen",
        key: "documentNumber",
        width: 24,
      },
      {
        header: "Tanggal Adjustment",
        key: "adjustmentDate",
        width: 20,
      },
      {
        header: "Reason",
        key: "reason",
        width: 18,
      },
      {
        header: "Status",
        key: "status",
        width: 14,
      },
      {
        header: "SKU",
        key: "sku",
        width: 18,
      },
      {
        header: "Nama Produk",
        key: "productName",
        width: 36,
      },
      {
        header: "Stock Sebelum",
        key: "stockBefore",
        width: 16,
      },
      {
        header: "Stock Sesudah",
        key: "stockAfter",
        width: 16,
      },
      {
        header: "Selisih",
        key: "difference",
        width: 14,
      },
      {
        header: "Catatan Dokumen",
        key: "documentNotes",
        width: 35,
      },
    ];

    // =====================================================
    // TITLE
    // =====================================================

    worksheet.mergeCells("A1:K1");

    const titleCell = worksheet.getCell("A1");

    titleCell.value = "LAPORAN STOCK ADJUSTMENT";

    titleCell.font = {
      bold: true,
      size: 16,
      color: {
        argb: "FFFFFFFF",
      },
    };

    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF001F33",
      },
    };

    titleCell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    worksheet.getRow(1).height = 28;

    // =====================================================
    // PERIOD
    // =====================================================

    worksheet.mergeCells("A2:K2");

    const periodCell = worksheet.getCell("A2");

    periodCell.value = `Periode: ${startDate} sampai ${endDate}`;

    periodCell.font = {
      italic: true,
      color: {
        argb: "FF475569",
      },
    };

    periodCell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    worksheet.getRow(2).height = 22;

    // =====================================================
    // TOTAL
    // =====================================================

    const totalItems = adjustments.reduce(
      (total, adjustment) => total + adjustment.items.length,
      0,
    );

    worksheet.mergeCells("A3:K3");

    const totalCell = worksheet.getCell("A3");

    totalCell.value =
      `Total dokumen: ${adjustments.length} | ` + `Total item: ${totalItems}`;

    totalCell.font = {
      bold: true,
      color: {
        argb: "FF334155",
      },
    };

    totalCell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    worksheet.getRow(3).height = 22;

    // =====================================================
    // TABLE HEADER
    // =====================================================

    const headerRow = worksheet.getRow(4);

    headerRow.values = worksheet.columns.map((column) =>
      String(column.header ?? ""),
    );

    headerRow.height = 25;

    headerRow.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: {
          argb: "FFFFFFFF",
        },
      };

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "FF0F4C75",
        },
      };

      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };

      cell.border = {
        top: {
          style: "thin",
          color: {
            argb: "FFD1D5DB",
          },
        },
        left: {
          style: "thin",
          color: {
            argb: "FFD1D5DB",
          },
        },
        bottom: {
          style: "thin",
          color: {
            argb: "FFD1D5DB",
          },
        },
        right: {
          style: "thin",
          color: {
            argb: "FFD1D5DB",
          },
        },
      };
    });

    // =====================================================
    // TABLE DATA
    // =====================================================

    let number = 1;

    for (const adjustment of adjustments) {
      const reasonLabel =
        reasonLabels[adjustment.reason as AdjustmentReason] ||
        adjustment.reason;

      const documentNotes = adjustment.notes?.trim() || "-";

      if (adjustment.items.length === 0) {
        worksheet.addRow({
          number,
          documentNumber: adjustment.documentNumber,
          adjustmentDate: formatDate(adjustment.adjustmentDate),
          reason: reasonLabel,
          status: adjustment.status,
          sku: "-",
          productName: "-",
          stockBefore: 0,
          stockAfter: 0,
          difference: 0,
          documentNotes,
        });

        number += 1;
        continue;
      }

      for (const item of adjustment.items) {
        worksheet.addRow({
          number,
          documentNumber: adjustment.documentNumber,
          adjustmentDate: formatDate(adjustment.adjustmentDate),
          reason: reasonLabel,
          status: adjustment.status,
          sku: item.product.sku || "-",
          productName: item.product.name,
          stockBefore: item.stockBefore,
          stockAfter: item.stockAfter,
          difference: item.difference,
          documentNotes,
        });

        number += 1;
      }
    }

    // =====================================================
    // TABLE FILTER
    // =====================================================

    worksheet.autoFilter = {
      from: "A4",
      to: "K4",
    };

    // =====================================================
    // TABLE STYLE
    // =====================================================

    for (let rowNumber = 5; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);

      row.alignment = {
        vertical: "top",
        wrapText: true,
      };

      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: {
            style: "thin",
            color: {
              argb: "FFE2E8F0",
            },
          },
          left: {
            style: "thin",
            color: {
              argb: "FFE2E8F0",
            },
          },
          bottom: {
            style: "thin",
            color: {
              argb: "FFE2E8F0",
            },
          },
          right: {
            style: "thin",
            color: {
              argb: "FFE2E8F0",
            },
          },
        };
      });

      if (rowNumber % 2 === 0) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: "FFF8FAFC",
            },
          };
        });
      }

      const differenceCell = row.getCell(10);

      const difference = Number(differenceCell.value || 0);

      if (difference > 0) {
        differenceCell.font = {
          bold: true,
          color: {
            argb: "FF15803D",
          },
        };
      } else if (difference < 0) {
        differenceCell.font = {
          bold: true,
          color: {
            argb: "FFDC2626",
          },
        };
      } else {
        differenceCell.font = {
          color: {
            argb: "FF64748B",
          },
        };
      }
    }

    // =====================================================
    // COLUMN FORMATTING
    // =====================================================

    worksheet.getColumn(1).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    worksheet.getColumn(5).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    worksheet.getColumn(8).numFmt = "#,##0";

    worksheet.getColumn(9).numFmt = "#,##0";

    worksheet.getColumn(10).numFmt = "+#,##0;-#,##0;0";

    worksheet.getColumn(8).alignment = {
      horizontal: "right",
      vertical: "middle",
    };

    worksheet.getColumn(9).alignment = {
      horizontal: "right",
      vertical: "middle",
    };

    worksheet.getColumn(10).alignment = {
      horizontal: "right",
      vertical: "middle",
    };

    worksheet.getColumn(11).alignment = {
      horizontal: "left",
      vertical: "top",
      wrapText: true,
    };

    // =====================================================
    // EMPTY DATA
    // =====================================================

    if (adjustments.length === 0) {
      worksheet.mergeCells("A5:K5");

      const emptyCell = worksheet.getCell("A5");

      emptyCell.value =
        "Tidak ada data stock adjustment pada periode yang dipilih.";

      emptyCell.font = {
        italic: true,
        color: {
          argb: "FF64748B",
        },
      };

      emptyCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      worksheet.getRow(5).height = 30;
    }

    // =====================================================
    // CREATE EXCEL FILE
    // =====================================================

    const buffer = await workbook.xlsx.writeBuffer();

    const filename =
      `stock-adjustments_` + `${startDate}_sampai_${endDate}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/stock-adjustments/export error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Gagal export stock adjustment",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
