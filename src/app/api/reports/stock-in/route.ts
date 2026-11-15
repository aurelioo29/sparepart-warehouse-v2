import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { excelResponse } from "@/lib/excel";

function formatDateForFile() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function buildEndDate(value: string) {
  const endDate = new Date(value);
  endDate.setHours(23, 59, 59, 999);

  return endDate;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const exportType = (searchParams.get("export") || "").trim();

    const auth = await requirePermission(
      exportType === "xlsx"
        ? "reports.stock_in.export"
        : "reports.stock_in.view",
    );

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const search = (searchParams.get("search") || "").trim();
    const supplierId = (searchParams.get("supplierId") || "").trim();
    const productId = (searchParams.get("productId") || "").trim();
    const warehouseId = (searchParams.get("warehouseId") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();

    const stockInWhere: Prisma.StockInWhereInput = {
      status: "POSTED",
    };

    if (supplierId) {
      stockInWhere.supplierId = supplierId;
    }

    if (dateFrom || dateTo) {
      stockInWhere.stockInDate = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: buildEndDate(dateTo) } : {}),
      };
    }

    const where: Prisma.StockInItemWhereInput = {
      stockIn: stockInWhere,
    };

    if (productId) {
      where.productId = productId;
    }

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (search) {
      where.OR = [
        {
          stockIn: {
            documentNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          stockIn: {
            invoiceNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          stockIn: {
            supplier: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          product: {
            sku: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          product: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const items = await prisma.stockInItem.findMany({
      where,
      include: {
        stockIn: {
          include: {
            supplier: {
              select: {
                id: true,
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
          },
        },
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: {
              select: {
                id: true,
                shortName: true,
              },
            },
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
      orderBy: [
        {
          stockIn: {
            stockInDate: "desc",
          },
        },
        {
          stockIn: {
            documentNumber: "desc",
          },
        },
      ],
    });

    const rows = items.map((item) => ({
      /**
       * ID dokumen Stock In.
       * Ini yang dipakai frontend untuk link:
       * /dashboard/stock-ins/[stockInId]
       */
      stockInId: item.stockIn.id,

      /**
       * ID item/baris Stock In.
       * Ini aman dipakai untuk row key table.
       */
      rowId: item.id,

      documentNumber: item.stockIn.documentNumber,
      stockInDate: formatDate(item.stockIn.stockInDate),
      supplier: item.stockIn.supplier?.name || "-",

      sku: item.product.sku,
      productName: item.product.name,
      unit: item.product.unit.shortName,

      warehouse: item.warehouse?.name || "-",
      rackLocation: item.rackLocation?.name || "-",

      quantity: item.quantity,
      unitPrice: Number(item.unitPrice || 0),
      totalPrice: Number(item.totalPrice || 0),

      createdBy:
        item.stockIn.createdBy?.fullName ||
        item.stockIn.createdBy?.username ||
        "-",
      notes: item.stockIn.notes || "",
    }));

    const summary = rows.reduce(
      (acc, item) => {
        acc.totalRows += 1;
        acc.totalQuantity += item.quantity;
        acc.totalAmount += item.totalPrice;

        return acc;
      },
      {
        totalRows: 0,
        totalQuantity: 0,
        totalAmount: 0,
      },
    );

    if (exportType === "xlsx") {
      return excelResponse({
        filename: `stock-in-report-${formatDateForFile()}.xlsx`,
        sheetName: "Stock In Report",
        columns: [
          { header: "Document Number", key: "documentNumber", width: 24 },
          { header: "Date", key: "stockInDate", width: 16 },
          { header: "Supplier", key: "supplier", width: 28 },
          { header: "SKU", key: "sku", width: 22 },
          { header: "Product", key: "productName", width: 36 },
          { header: "Unit", key: "unit", width: 12 },
          { header: "Warehouse", key: "warehouse", width: 24 },
          { header: "Rack Location", key: "rackLocation", width: 24 },
          { header: "Quantity", key: "quantity", width: 14 },
          { header: "Unit Price", key: "unitPrice", width: 18 },
          { header: "Total Price", key: "totalPrice", width: 18 },
          { header: "Created By", key: "createdBy", width: 24 },
          { header: "Notes", key: "notes", width: 36 },
        ],
        rows,
      });
    }

    return successResponse({
      message: "Stock in report retrieved successfully",
      data: {
        summary,
        items: rows,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/stock-in error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch stock in report",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
