import { Prisma, StockOutReason } from "@/../prisma/generated/prisma/client";

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

function isStockOutReason(value: string): value is StockOutReason {
  return Object.values(StockOutReason).includes(value as StockOutReason);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const exportType = (searchParams.get("export") || "").trim();

    const auth = await requirePermission(
      exportType === "xlsx"
        ? "reports.stock_out.export"
        : "reports.stock_out.view",
    );

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const search = (searchParams.get("search") || "").trim();
    const reason = (searchParams.get("reason") || "").trim();
    const productId = (searchParams.get("productId") || "").trim();
    const warehouseId = (searchParams.get("warehouseId") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();

    const stockOutWhere: Prisma.StockOutWhereInput = {
      status: "POSTED",
    };

    if (reason) {
      if (!isStockOutReason(reason)) {
        return errorResponse({
          message: "Invalid stock out reason",
          status: 400,
        });
      }

      stockOutWhere.reason = reason;
    }

    if (dateFrom || dateTo) {
      stockOutWhere.stockOutDate = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const where: Prisma.StockOutItemWhereInput = {
      stockOut: stockOutWhere,
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
          stockOut: {
            documentNumber: {
              contains: search,
              mode: "insensitive",
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

    const items = await prisma.stockOutItem.findMany({
      where,
      include: {
        stockOut: {
          include: {
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
      orderBy: {
        stockOut: {
          stockOutDate: "desc",
        },
      },
    });

    const rows = items.map((item) => ({
      id: item.id,
      documentNumber: item.stockOut.documentNumber,
      stockOutDate: formatDate(item.stockOut.stockOutDate),
      reason: item.stockOut.reason,
      sku: item.product.sku,
      productName: item.product.name,
      unit: item.product.unit.shortName,
      warehouse: item.warehouse?.name || "-",
      rackLocation: item.rackLocation?.name || "-",
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice || 0),
      totalPrice: Number(item.totalPrice || 0),
      createdBy: item.stockOut.createdBy?.fullName || "-",
      notes: item.notes || item.stockOut.notes || "",
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
        filename: `stock-out-report-${formatDateForFile()}.xlsx`,
        sheetName: "Stock Out Report",
        columns: [
          { header: "Document Number", key: "documentNumber", width: 24 },
          { header: "Date", key: "stockOutDate", width: 16 },
          { header: "Reason", key: "reason", width: 22 },
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
      message: "Stock out report retrieved successfully",
      data: {
        summary,
        items: rows,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/stock-out error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch stock out report",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
