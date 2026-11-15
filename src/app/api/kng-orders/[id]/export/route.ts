import ExcelJS from "exceljs";

import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type OrderExcelItem = {
  id: string;
  jenisSnapshot: string;
  partNumberSnapshot: string;
  quantity: number;
};

type PrintableExcelItem = OrderExcelItem & {
  rowSpan: number;
  showJenis: boolean;
  noInGroup: number;
};

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-");
}

function formatLongDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function buildPrintableRows(items: OrderExcelItem[]) {
  const rows: PrintableExcelItem[] = [];

  let index = 0;

  while (index < items.length) {
    const currentJenis = items[index].jenisSnapshot;
    const groupItems: OrderExcelItem[] = [];

    while (
      index < items.length &&
      items[index].jenisSnapshot === currentJenis
    ) {
      groupItems.push(items[index]);
      index += 1;
    }

    groupItems.forEach((item, groupIndex) => {
      rows.push({
        ...item,
        rowSpan: groupIndex === 0 ? groupItems.length : 0,
        showJenis: groupIndex === 0,
        noInGroup: groupIndex + 1,
      });
    });
  }

  return rows;
}

function applyBorder(cell: ExcelJS.Cell, style: ExcelJS.BorderStyle = "thin") {
  cell.border = {
    top: { style },
    left: { style },
    bottom: { style },
    right: { style },
  };
}

function applyFill(cell: ExcelJS.Cell, argb: string) {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb,
    },
  };
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("kng-orders.export");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const order = await prisma.kngOrder.findUnique({
      where: {
        id,
      },
      select: {
        orderNumber: true,
        orderDate: true,
        totalQty: true,
        noteFranco: true,
        noteTop: true,
        items: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            jenisSnapshot: true,
            partNumberSnapshot: true,
            quantity: true,
          },
        },
        createdBy: {
          select: {
            fullName: true,
          },
        },
      },
    });

    if (!order) {
      return errorResponse({
        message: "KNG order tidak ditemukan",
        status: 404,
      });
    }

    const printableRows = buildPrintableRows(order.items);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sparepart Warehouse";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Order KNG", {
      pageSetup: {
        paperSize: 9,
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.3,
          right: 0.3,
          top: 0.4,
          bottom: 0.4,
          header: 0.2,
          footer: 0.2,
        },
      },
    });

    worksheet.columns = [
      { key: "no", width: 7 },
      { key: "jenis", width: 26 },
      { key: "partNumber", width: 44 },
      { key: "quantity", width: 15 },
    ];

    worksheet.mergeCells("A1:D1");
    worksheet.getCell("A1").value = "Orderan";
    worksheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getCell("A1").font = {
      bold: true,
      size: 18,
      underline: true,
    };

    worksheet.mergeCells("A2:D2");
    worksheet.getCell("A2").value = order.orderNumber;
    worksheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getCell("A2").font = {
      bold: true,
      size: 16,
      underline: true,
    };

    worksheet.getCell("C4").value = "Product KNG";
    worksheet.getCell("C4").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getCell("C4").font = {
      bold: true,
      color: {
        argb: "FF000000",
      },
    };

    for (let column = 1; column <= 4; column += 1) {
      applyBorder(worksheet.getCell(4, column));
    }

    applyFill(worksheet.getCell("C4"), "FFFF0000");
    applyFill(worksheet.getCell("D4"), "FFFFFF00");

    const headerRow = worksheet.getRow(5);
    headerRow.values = ["No", "Jenis", "Part Number", "Order/pc"];

    headerRow.eachCell((cell, colNumber) => {
      cell.font = {
        bold: true,
      };
      cell.alignment = {
        horizontal: colNumber === 4 ? "right" : "center",
        vertical: "middle",
        wrapText: true,
      };

      applyBorder(cell);

      if (colNumber === 4) {
        applyFill(cell, "FFFFFF00");
      }
    });

    const dataStartRowNumber = 6;

    printableRows.forEach((item) => {
      const row = worksheet.addRow([
        item.noInGroup,
        item.showJenis ? item.jenisSnapshot : "",
        item.partNumberSnapshot,
        item.quantity,
      ]);

      for (let column = 1; column <= 4; column += 1) {
        const cell = row.getCell(column);

        cell.alignment = {
          vertical: "middle",
          wrapText: true,
          horizontal: column === 4 ? "right" : column === 3 ? "left" : "center",
        };

        applyBorder(cell);
      }

      row.getCell(3).font = {
        bold: true,
      };
      row.getCell(4).numFmt = "#,##0";
    });

    let currentExcelRow = dataStartRowNumber;

    printableRows.forEach((item) => {
      if (item.showJenis && item.rowSpan > 1) {
        worksheet.mergeCells(
          currentExcelRow,
          2,
          currentExcelRow + item.rowSpan - 1,
          2,
        );

        const mergedCell = worksheet.getCell(currentExcelRow, 2);

        mergedCell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        mergedCell.font = {
          bold: true,
        };

        applyBorder(mergedCell);
      }

      currentExcelRow += 1;
    });

    const totalRow = worksheet.addRow(["TOTAL QTY", "", "", order.totalQty]);

    worksheet.mergeCells(totalRow.number, 1, totalRow.number, 3);

    for (let column = 1; column <= 4; column += 1) {
      const cell = totalRow.getCell(column);

      cell.font = {
        bold: true,
        size: column === 4 ? 14 : 16,
      };
      cell.alignment = {
        horizontal: column === 4 ? "right" : "center",
        vertical: "middle",
      };

      applyBorder(cell, "medium");
    }

    totalRow.getCell(4).numFmt = "#,##0";

    // Keterangan di kiri, tanggal dan tanda tangan di kanan.
    const noteStartRow = totalRow.number + 3;

    const noteLines = [
      "Keterangan :",
      `1. ${order.noteFranco || "Frangko Medan"}`,
      `2. ${order.noteTop || "Top = 125 hari"}`,
    ];

    noteLines.forEach((text, index) => {
      const rowNumber = noteStartRow + index;

      worksheet.mergeCells(rowNumber, 1, rowNumber, 2);

      const cell = worksheet.getCell(rowNumber, 1);
      cell.value = text;
      cell.alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
    });

    const signatureLines = [
      {
        row: noteStartRow,
        value: `Medan, ${formatLongDate(order.orderDate)}`,
      },
      {
        row: noteStartRow + 1,
        value: "TTd",
      },
      {
        row: noteStartRow + 5,
        value: order.createdBy?.fullName || "Rudy Prasetyo",
      },
    ];

    signatureLines.forEach(({ row, value }) => {
      worksheet.mergeCells(row, 3, row, 4);

      const cell = worksheet.getCell(row, 3);
      cell.value = value;
      cell.alignment = {
        horizontal: "right",
        vertical: "middle",
        wrapText: true,
      };
    });

    worksheet.eachRow((row) => {
      row.height = 23;
    });

    worksheet.getRow(1).height = 28;
    worksheet.getRow(2).height = 26;
    worksheet.getRow(5).height = 26;

    worksheet.pageSetup.printArea = `A1:D${noteStartRow + 5}`;

    const buffer = await workbook.xlsx.writeBuffer();

    const filename = `Order-KNG-${safeFileName(order.orderNumber)}.xlsx`;

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
    console.error("GET /api/kng-orders/[id]/export error:", error);

    return errorResponse({
      message: "Failed to export KNG order",
      status: 500,
    });
  }
}
