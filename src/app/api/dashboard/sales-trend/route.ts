import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import {
  createPostedSalesWhere,
  getSalesMonthRange,
  getWibDateParts,
} from "@/lib/sales-report-filters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const monthNames = [
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

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("reports.salesman.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { searchParams } = new URL(req.url);
    const now = getWibDateParts();

    const year = Number(searchParams.get("year") || now.year);

    if (!Number.isInteger(year) || year < 2000 || year > now.year) {
      return errorResponse({
        message: `Tahun harus antara 2000 dan ${now.year}`,
        status: 400,
      });
    }

    // Untuk tahun berjalan, bulan mendatang belum dihitung.
    const monthsToQuery = year === now.year ? now.month : 12;

    const results = await prisma.$transaction(
      Array.from({ length: monthsToQuery }, (_, index) => {
        const month = index + 1;

        // Gunakan batas bulan dan filter status yang sama
        // dengan laporan penjualan.
        const range = getSalesMonthRange(year, month);

        return prisma.sale.aggregate({
          where: createPostedSalesWhere(range),
          _sum: {
            totalAmount: true,
          },
          _count: {
            _all: true,
          },
        });
      }),
    );

    const items = monthNames.map((label, index) => {
      const month = index + 1;
      const result = results[index];

      const isFuture = year === now.year && month > now.month;

      return {
        month,
        label,
        shortLabel: label.slice(0, 3),
        totalSales: Number(result?._sum.totalAmount || 0),
        totalInvoices: result?._count._all || 0,
        isFuture,
        isCurrentMonth: year === now.year && month === now.month,
      };
    });

    const activeItems = items.filter((item) => !item.isFuture);

    const totalSales = activeItems.reduce(
      (sum, item) => sum + item.totalSales,
      0,
    );

    const totalInvoices = activeItems.reduce(
      (sum, item) => sum + item.totalInvoices,
      0,
    );

    // Bulan tanpa faktur tidak dipilih sebagai bulan terlaris.
    const highestMonth =
      activeItems
        .filter((item) => item.totalInvoices > 0)
        .sort((a, b) => b.totalSales - a.totalSales)[0] || null;

    return successResponse({
      message: "Tren penjualan berhasil dimuat",
      data: {
        year,
        currentYear: now.year,
        currentMonth: now.month,
        items,
        summary: {
          totalSales,
          totalInvoices,
          highestMonth: highestMonth
            ? {
                month: highestMonth.month,
                label: highestMonth.label,
                totalSales: highestMonth.totalSales,
              }
            : null,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/sales-trend error:", error);

    return errorResponse({
      message: "Gagal mengambil tren penjualan",
      status: 500,
    });
  }
}
