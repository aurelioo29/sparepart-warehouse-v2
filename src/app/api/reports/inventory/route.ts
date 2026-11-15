import ExcelJS from "exceljs";

import { errorResponse, successResponse } from "@/lib/api-response";

import { requirePermission } from "@/lib/auth/permissions";

import {
  getLiveInventory,
  getMonthlyInventory,
  InventoryPeriodError,
} from "@/lib/inventory/monthly-snapshot";

import { currentPeriod } from "@/lib/inventory/monthly-core";

import type {
  InventoryFilters,
  InventoryPeriod,
  InventoryRow,
  InventorySummary,
} from "@/lib/inventory/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDateForFile() {
  const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);

  return nowWib.toISOString().slice(0, 10);
}

function formatRupiahForExcel(value: number) {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function sortInventoryRows(rows: InventoryRow[]) {
  return [...rows].sort((a, b) => {
    const categoryCompare = a.category.localeCompare(b.category);

    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    const productCompare = a.productName.localeCompare(b.productName);

    if (productCompare !== 0) {
      return productCompare;
    }

    return a.sku.localeCompare(b.sku);
  });
}

function summarizeInventory(rows: InventoryRow[]): InventorySummary {
  return rows.reduce<InventorySummary>(
    (summary, item) => {
      summary.totalItems += 1;
      summary.totalStock += item.currentStock;
      summary.totalPurchaseValue += item.purchaseStockValue;
      summary.totalSellingValue += item.sellingStockValue;

      if (item.stockStatus === "LOW_STOCK") {
        summary.lowStockItems += 1;
      }

      if (item.stockStatus === "OUT_OF_STOCK") {
        summary.outOfStockItems += 1;
      }

      return summary;
    },
    {
      totalItems: 0,
      totalStock: 0,
      totalPurchaseValue: 0,
      totalSellingValue: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
    },
  );
}

async function inventoryExcelResponse({
  filename,
  rows,
  period,
}: {
  filename: string;
  rows: InventoryRow[];
  period?: InventoryPeriod;
}) {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Warehouse System";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Inventory Report");

  worksheet.columns = [
    {
      header: "Product Name",
      key: "productName",
      width: 42,
    },
    {
      header: "SKU",
      key: "sku",
      width: 24,
    },
    {
      header: period ? "Stok Akhir Bulan" : "Current Stock",
      key: "currentStock",
      width: 20,
    },
    {
      header: period ? "Harga Jual Saat Rekap" : "Harga Jual",
      key: "sellingPrice",
      width: 26,
    },
  ];

  const defaultFont = {
    name: "Times New Roman",
    size: 14,
  };

  const border: Partial<ExcelJS.Borders> = {
    top: {
      style: "thin",
      color: {
        argb: "FF000000",
      },
    },
    left: {
      style: "thin",
      color: {
        argb: "FF000000",
      },
    },
    bottom: {
      style: "thin",
      color: {
        argb: "FF000000",
      },
    },
    right: {
      style: "thin",
      color: {
        argb: "FF000000",
      },
    },
  };

  const headerRow = worksheet.getRow(1);

  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = {
      ...defaultFont,
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF1F2937",
      },
    };

    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    cell.border = border;
  });

  let previousCategory = "";

  rows.forEach((item, index) => {
    if (index > 0 && item.category !== previousCategory) {
      const spacer = worksheet.addRow({});

      spacer.height = 24;

      for (let column = 1; column <= 4; column += 1) {
        const cell = spacer.getCell(column);

        cell.font = defaultFont;
        cell.border = border;
        cell.alignment = {
          vertical: "middle",
        };
      }
    }

    const row = worksheet.addRow({
      productName: item.productName,
      sku: item.sku,
      currentStock: item.currentStock,
      sellingPrice: formatRupiahForExcel(item.sellingPrice),
    });

    row.height = 24;

    const isOutOfStock = item.currentStock === 0;

    row.eachCell((cell) => {
      cell.font = {
        ...defaultFont,
        bold: isOutOfStock,
        color: {
          argb: isOutOfStock ? "FFFF0000" : "FF111827",
        },
      };

      cell.border = border;

      cell.alignment = {
        vertical: "middle",
      };
    });

    row.getCell("productName").alignment = {
      vertical: "middle",
      horizontal: "left",
    };

    row.getCell("sku").alignment = {
      vertical: "middle",
      horizontal: "left",
    };

    row.getCell("currentStock").alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    row.getCell("sellingPrice").alignment = {
      vertical: "middle",
      horizontal: "left",
    };

    previousCategory = item.category;
  });

  worksheet.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];

  worksheet.pageSetup = {
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  if (period) {
    worksheet.headerFooter.oddHeader = `Rekap Stok Akhir Bulan ${period.year}-${String(
      period.month,
    ).padStart(2, "0")} WIB`;

    worksheet.headerFooter.oddFooter =
      "Harga merupakan salinan ketika rekap dibuat.";
  }

  const buffer = await workbook.xlsx.writeBuffer();

  // Uint8Array kompatibel dengan BodyInit Response.
  const body = new Uint8Array(buffer);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const exportType = (searchParams.get("export") || "").trim();

    const auth = await requirePermission(
      exportType === "xlsx"
        ? "reports.inventory.export"
        : "reports.inventory.view",
    );

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const selectedPeriod = (searchParams.get("period") || "").trim();

    const stockStatus = (searchParams.get("stockStatus") || "").trim();

    if (
      stockStatus &&
      !["NORMAL", "LOW_STOCK", "OUT_OF_STOCK"].includes(stockStatus)
    ) {
      return errorResponse({
        message: "Status stok tidak valid.",
        status: 400,
      });
    }

    const filters: InventoryFilters = {
      search: (searchParams.get("search") || "").trim(),

      categoryId: (searchParams.get("categoryId") || "").trim(),

      brandId: (searchParams.get("brandId") || "").trim(),

      warehouseId: (searchParams.get("warehouseId") || "").trim(),
    };

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const value of [
      filters.categoryId,
      filters.brandId,
      filters.warehouseId,
    ]) {
      if (value && !uuidPattern.test(value)) {
        return errorResponse({
          message: "ID filter tidak valid.",
          status: 400,
        });
      }
    }

    let rows: InventoryRow[];
    let period: InventoryPeriod | undefined;

    if (selectedPeriod) {
      const monthly = await getMonthlyInventory(selectedPeriod, filters);

      rows = monthly.items;
      period = monthly.period;
    } else {
      rows = await getLiveInventory(filters);
    }

    if (stockStatus) {
      rows = rows.filter((row) => row.stockStatus === stockStatus);
    }

    rows = sortInventoryRows(rows);

    const summary = summarizeInventory(rows);

    if (exportType === "xlsx") {
      const filename = `inventory-report-${
        selectedPeriod || formatDateForFile()
      }.xlsx`;

      return inventoryExcelResponse({
        filename,
        rows,
        period,
      });
    }

    return successResponse({
      message: selectedPeriod
        ? "Monthly inventory report retrieved successfully"
        : "Inventory report retrieved successfully",
      data: {
        summary,
        items: rows,
        period,
        currentPeriod: currentPeriod(),
      },
    });
  } catch (error) {
    if (error instanceof InventoryPeriodError) {
      return errorResponse({
        message: error.message,
        status: error.status,
      });
    }

    console.error("GET /api/reports/inventory error:", error);

    return errorResponse({
      message: "Gagal mengambil laporan inventory.",
      status: 500,
    });
  }
}
