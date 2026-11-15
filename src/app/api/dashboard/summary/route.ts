import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import {
  createPostedSalesWhere,
  getSalesDayRange,
  getSalesMonthRange,
  getWibDateParts,
} from "@/lib/sales-report-filters";

export const dynamic = "force-dynamic";
export const revalidate = 0;
function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { start, end };
}
function toNumber(value: unknown) {
  return Number(value || 0);
}
function getOverdueDays(dueDate: Date | null) {
  if (!dueDate) return 0;
  const today = new Date();
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const dueOnly = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );
  const diffMs = todayOnly.getTime() - dueOnly.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 0);
}
export async function GET() {
  try {
    const auth = await requirePermission("dashboard.view");
    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }
    const now = new Date();
    const { year, month } = getWibDateParts(now);
    const salesTodayRange = getSalesDayRange(now);
    const salesMonthRange = getSalesMonthRange(year, month);
    // Existing stock/purchase queries retain their own period handling.
    const monthRange = getMonthRange();
    const [
      products,
      stockInThisMonth,
      stockOutThisMonth,
      stockMovementsThisMonth,
      salesToday,
      salesThisMonth,
      receivables,
      overdueReceivables,
      payables,
      overduePayables,
      purchasePaymentsThisMonth,
      receivableReceivedThisMonth,
      totalReceivableReceived,
      recentMovements,
      recentSales,
      recentPurchasePayments,
      saleItemsThisMonth,
      recentStockIns,
    ] = await Promise.all([
      prisma.product.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          sku: true,
          name: true,
          currentStock: true,
          minStock: true,
          purchasePrice: true,
          sellingPrice: true,
          category: {
            select: {
              name: true,
            },
          },
          brand: {
            select: {
              name: true,
            },
          },
          unit: {
            select: {
              shortName: true,
            },
          },
          warehouse: {
            select: {
              name: true,
              code: true,
            },
          },
          rackLocation: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      }),
      prisma.stockIn.aggregate({
        where: {
          status: "POSTED",
          stockInDate: {
            gte: monthRange.start,
            lte: monthRange.end,
          },
        },
        _count: {
          id: true,
        },
        _sum: {
          totalAmount: true,
          paidAmount: true,
          remainingAmount: true,
        },
      }),
      prisma.stockOut.aggregate({
        where: {
          status: "POSTED",
          stockOutDate: {
            gte: monthRange.start,
            lte: monthRange.end,
          },
        },
        _count: {
          id: true,
        },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.stockMovement.findMany({
        where: {
          createdAt: {
            gte: monthRange.start,
            lte: monthRange.end,
          },
        },
        select: {
          id: true,
          type: true,
          quantity: true,
          referenceType: true,
          createdAt: true,
        },
      }),
      prisma.sale.aggregate({
        where: createPostedSalesWhere(salesTodayRange),
        _count: {
          id: true,
        },
        _sum: {
          totalAmount: true,
          paidAmount: true,
          remainingAmount: true,
        },
      }),
      prisma.sale.aggregate({
        where: createPostedSalesWhere(salesMonthRange),
        _count: {
          id: true,
        },
        _sum: {
          totalAmount: true,
          paidAmount: true,
          remainingAmount: true,
        },
      }),
      prisma.sale.aggregate({
        where: {
          ...createPostedSalesWhere(),
          paymentStatus: {
            in: ["UNPAID", "PARTIAL"],
          },
          remainingAmount: {
            gt: 0,
          },
        },
        _count: {
          id: true,
        },
        _sum: {
          remainingAmount: true,
        },
      }),
      prisma.sale.findMany({
        where: {
          ...createPostedSalesWhere(),
          paymentStatus: {
            in: ["UNPAID", "PARTIAL"],
          },
          remainingAmount: {
            gt: 0,
          },
          dueDate: {
            lt: now,
          },
        },
        take: 8,
        orderBy: {
          dueDate: "asc",
        },
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
      }),
      prisma.stockIn.aggregate({
        where: {
          status: "POSTED",
          paymentStatus: {
            in: ["UNPAID", "PARTIAL"],
          },
          remainingAmount: {
            gt: 0,
          },
        },
        _count: {
          id: true,
        },
        _sum: {
          remainingAmount: true,
        },
      }),
      prisma.stockIn.findMany({
        where: {
          status: "POSTED",
          paymentStatus: {
            in: ["UNPAID", "PARTIAL"],
          },
          remainingAmount: {
            gt: 0,
          },
          dueDate: {
            lt: now,
          },
        },
        take: 8,
        orderBy: {
          dueDate: "asc",
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              phone: true,
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
      }),
      prisma.purchasePayment.aggregate({
        where: {
          paymentDate: {
            gte: monthRange.start,
            lte: monthRange.end,
          },
        },
        _count: {
          id: true,
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.salePayment.aggregate({
        where: {
          paymentDate: {
            gte: salesMonthRange.start,
            lt: salesMonthRange.endExclusive,
          },
          sale: createPostedSalesWhere(),
        },
        _count: {
          id: true,
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.salePayment.aggregate({
        where: {
          sale: {
            status: "POSTED",
          },
        },
        _count: {
          id: true,
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.stockMovement.findMany({
        take: 8,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          product: {
            select: {
              sku: true,
              name: true,
              unit: {
                select: {
                  shortName: true,
                },
              },
            },
          },
          createdBy: {
            select: {
              fullName: true,
              username: true,
            },
          },
        },
      }),
      prisma.sale.findMany({
        where: createPostedSalesWhere(),
        take: 8,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          customer: {
            select: {
              name: true,
            },
          },
          salesman: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.purchasePayment.findMany({
        take: 8,
        orderBy: {
          paymentDate: "desc",
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          stockIn: {
            select: {
              id: true,
              documentNumber: true,
              invoiceNumber: true,
              totalAmount: true,
              paidAmount: true,
              remainingAmount: true,
              paymentStatus: true,
            },
          },
          createdBy: {
            select: {
              fullName: true,
              username: true,
            },
          },
        },
      }),
      prisma.saleItem.findMany({
        where: {
          sale: createPostedSalesWhere(salesMonthRange),
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: {
                select: {
                  shortName: true,
                },
              },
            },
          },
        },
      }),
      prisma.stockIn.findMany({
        take: 8,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          createdBy: {
            select: {
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
      }),
    ]);
    const totalProducts = products.length;
    const normalStockItems = products.filter(
      (product) => product.currentStock > product.minStock,
    ).length;
    const lowStockItems = products.filter(
      (product) =>
        product.currentStock > 0 && product.currentStock <= product.minStock,
    ).length;
    const outOfStockItems = products.filter(
      (product) => product.currentStock === 0,
    ).length;
    const totalStockQuantity = products.reduce(
      (total, product) => total + product.currentStock,
      0,
    );
    const totalPurchaseStockValue = products.reduce(
      (total, product) =>
        total + product.currentStock * Number(product.purchasePrice || 0),
      0,
    );
    const totalSellingStockValue = products.reduce(
      (total, product) =>
        total + product.currentStock * Number(product.sellingPrice || 0),
      0,
    );
    const criticalStockItems = products
      .map((product) => {
        const stockStatus =
          product.currentStock === 0
            ? "OUT_OF_STOCK"
            : product.currentStock <= product.minStock
              ? "LOW_STOCK"
              : "NORMAL";
        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category?.name || "-",
          brand: product.brand?.name || "-",
          unit: product.unit?.shortName || "-",
          warehouse: product.warehouse?.name || "-",
          rackLocation: product.rackLocation?.name || "-",
          currentStock: product.currentStock,
          minStock: product.minStock,
          shortage: Math.max(product.minStock - product.currentStock, 0),
          stockStatus,
        };
      })
      .filter((product) => product.stockStatus !== "NORMAL")
      .sort((a, b) => {
        if (
          a.stockStatus === "OUT_OF_STOCK" &&
          b.stockStatus !== "OUT_OF_STOCK"
        ) {
          return -1;
        }
        if (
          a.stockStatus !== "OUT_OF_STOCK" &&
          b.stockStatus === "OUT_OF_STOCK"
        ) {
          return 1;
        }
        return b.shortage - a.shortage;
      })
      .slice(0, 8);
    const movementSummary = stockMovementsThisMonth.reduce(
      (acc, movement) => {
        if (movement.type === "IN") acc.in += movement.quantity;
        if (movement.type === "OUT") acc.out += movement.quantity;
        if (movement.type === "ADJUSTMENT") {
          acc.adjustment += movement.quantity;
        }
        return acc;
      },
      {
        in: 0,
        out: 0,
        adjustment: 0,
      },
    );
    const paymentStatusSummary = recentSales.reduce(
      (acc, sale) => {
        if (sale.paymentStatus === "PAID") acc.paid += 1;
        if (sale.paymentStatus === "PARTIAL") acc.partial += 1;
        if (sale.paymentStatus === "UNPAID") acc.unpaid += 1;
        return acc;
      },
      {
        paid: 0,
        partial: 0,
        unpaid: 0,
      },
    );
    const purchasePaymentStatusSummary = recentStockIns.reduce(
      (acc, stockIn) => {
        if (stockIn.paymentStatus === "PAID") acc.paid += 1;
        if (stockIn.paymentStatus === "PARTIAL") acc.partial += 1;
        if (stockIn.paymentStatus === "UNPAID") acc.unpaid += 1;
        return acc;
      },
      {
        paid: 0,
        partial: 0,
        unpaid: 0,
      },
    );
    const topSellingMap = new Map<
      string,
      {
        productId: string;
        sku: string;
        name: string;
        unit: string;
        totalQty: number;
        totalAmount: number;
      }
    >();
    for (const item of saleItemsThisMonth) {
      const key = item.productId;
      const existing = topSellingMap.get(key) || {
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        unit: item.product.unit.shortName,
        totalQty: 0,
        totalAmount: 0,
      };
      existing.totalQty += item.quantity;
      existing.totalAmount += Number(item.totalPrice || 0);
      topSellingMap.set(key, existing);
    }
    const topSellingProducts = Array.from(topSellingMap.values())
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 8);
    const formattedOverdueReceivables = overdueReceivables.map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate,
      dueDate: sale.dueDate,
      customer: sale.customer,
      salesman: sale.salesman,
      totalAmount: Number(sale.totalAmount || 0),
      paidAmount: Number(sale.paidAmount || 0),
      remainingAmount: Number(sale.remainingAmount || 0),
      paymentStatus: sale.paymentStatus,
      overdueDays: getOverdueDays(sale.dueDate),
    }));
    const overdueReceivableSummary = formattedOverdueReceivables.reduce(
      (acc, item) => {
        acc.totalInvoices += 1;
        acc.totalAmount += item.remainingAmount;
        return acc;
      },
      {
        totalInvoices: 0,
        totalAmount: 0,
      },
    );
    const formattedOverduePayables = overduePayables.map((stockIn) => ({
      id: stockIn.id,
      documentNumber: stockIn.documentNumber,
      invoiceNumber: stockIn.invoiceNumber,
      stockInDate: stockIn.stockInDate,
      dueDate: stockIn.dueDate,
      supplier: stockIn.supplier,
      totalAmount: Number(stockIn.totalAmount || 0),
      paidAmount: Number(stockIn.paidAmount || 0),
      remainingAmount: Number(stockIn.remainingAmount || 0),
      paymentStatus: stockIn.paymentStatus,
      overdueDays: getOverdueDays(stockIn.dueDate),
      createdBy: stockIn.createdBy,
    }));
    const overduePayableSummary = formattedOverduePayables.reduce(
      (acc, item) => {
        acc.totalInvoices += 1;
        acc.totalAmount += item.remainingAmount;
        return acc;
      },
      {
        totalInvoices: 0,
        totalAmount: 0,
      },
    );
    const formattedRecentStockIns = recentStockIns.map((stockIn) => ({
      id: stockIn.id,
      documentNumber: stockIn.documentNumber,
      invoiceNumber: stockIn.invoiceNumber,
      stockInDate: stockIn.stockInDate,
      dueDate: stockIn.dueDate,
      status: stockIn.status,
      paymentStatus: stockIn.paymentStatus,
      totalAmount: toNumber(stockIn.totalAmount),
      paidAmount: toNumber(stockIn.paidAmount),
      remainingAmount: toNumber(stockIn.remainingAmount),
      supplier: stockIn.supplier,
      createdBy: stockIn.createdBy,
      itemCount: stockIn._count.items,
      paymentCount: stockIn._count.payments,
    }));
    const formattedRecentPurchasePayments = recentPurchasePayments.map(
      (payment) => ({
        id: payment.id,
        paymentDate: payment.paymentDate,
        amount: toNumber(payment.amount),
        method: payment.method,
        referenceNumber: payment.referenceNumber,
        supplier: payment.supplier,
        stockIn: payment.stockIn
          ? {
              ...payment.stockIn,
              totalAmount: toNumber(payment.stockIn.totalAmount),
              paidAmount: toNumber(payment.stockIn.paidAmount),
              remainingAmount: toNumber(payment.stockIn.remainingAmount),
            }
          : null,
        createdBy: payment.createdBy,
      }),
    );
    return successResponse({
      message: "Dashboard summary retrieved successfully",
      data: {
        cards: {
          totalProducts,
          totalStockQuantity,
          normalStockItems,
          lowStockItems,
          outOfStockItems,
          totalPurchaseStockValue,
          totalSellingStockValue,
          stockInThisMonthCount: stockInThisMonth._count.id,
          stockInThisMonthAmount: toNumber(stockInThisMonth._sum.totalAmount),
          stockInPaidThisMonthAmount: toNumber(
            stockInThisMonth._sum.paidAmount,
          ),
          stockInRemainingThisMonthAmount: toNumber(
            stockInThisMonth._sum.remainingAmount,
          ),
          stockOutThisMonthCount: stockOutThisMonth._count.id,
          stockOutThisMonthAmount: toNumber(stockOutThisMonth._sum.totalAmount),
          purchasePaymentThisMonthCount: purchasePaymentsThisMonth._count.id,
          purchasePaymentThisMonthAmount: toNumber(
            purchasePaymentsThisMonth._sum.amount,
          ),
          salesTodayCount: salesToday._count.id,
          salesTodayAmount: toNumber(salesToday._sum.totalAmount),
          salesThisMonthCount: salesThisMonth._count.id,
          salesThisMonthAmount: toNumber(salesThisMonth._sum.totalAmount),
          salesPaidThisMonthAmount: toNumber(salesThisMonth._sum.paidAmount),
          salesRemainingThisMonthAmount: toNumber(
            salesThisMonth._sum.remainingAmount,
          ),
          receivableReceivedThisMonthCount:
            receivableReceivedThisMonth._count.id,
          receivableReceivedThisMonthAmount: toNumber(
            receivableReceivedThisMonth._sum.amount,
          ),
          totalReceivableReceivedCount: totalReceivableReceived._count.id,
          totalReceivableReceivedAmount: toNumber(
            totalReceivableReceived._sum.amount,
          ),
          receivableInvoices: receivables._count.id,
          receivableAmount: toNumber(receivables._sum.remainingAmount),
          overdueInvoices: overdueReceivableSummary.totalInvoices,
          overdueAmount: overdueReceivableSummary.totalAmount,
          payableInvoices: payables._count.id,
          payableAmount: toNumber(payables._sum.remainingAmount),
          overduePayableInvoices: overduePayableSummary.totalInvoices,
          overduePayableAmount: overduePayableSummary.totalAmount,
        },
        charts: {
          stockHealth: {
            normal: normalStockItems,
            lowStock: lowStockItems,
            outOfStock: outOfStockItems,
          },
          stockMovementThisMonth: movementSummary,
          salesVsReceivable: {
            sales: toNumber(salesThisMonth._sum.totalAmount),
            paid: toNumber(salesThisMonth._sum.paidAmount),
            remainingThisMonth: toNumber(salesThisMonth._sum.remainingAmount),
            totalReceivable: toNumber(receivables._sum.remainingAmount),
          },
          purchaseVsPayable: {
            purchases: toNumber(stockInThisMonth._sum.totalAmount),
            paid: toNumber(stockInThisMonth._sum.paidAmount),
            remainingThisMonth: toNumber(stockInThisMonth._sum.remainingAmount),
            totalPayable: toNumber(payables._sum.remainingAmount),
          },
          paymentStatus: paymentStatusSummary,
          purchasePaymentStatus: purchasePaymentStatusSummary,
        },
        tables: {
          criticalStockItems,
          topSellingProducts,
          overdueReceivables: formattedOverdueReceivables,
          overduePayables: formattedOverduePayables,
          recentStockIns: formattedRecentStockIns,
          recentPurchasePayments: formattedRecentPurchasePayments,
        },
        recentMovements,
        recentSales,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/summary error:", error);
    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch dashboard summary",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
