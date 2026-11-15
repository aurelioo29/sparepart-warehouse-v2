"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

type DashboardChartsProps = {
  charts: {
    stockHealth: {
      normal: number;
      lowStock: number;
      outOfStock: number;
    };
    stockMovementThisMonth: {
      in: number;
      out: number;
      adjustment: number;
    };
    salesVsReceivable: {
      sales: number;
      paid: number;
      remainingThisMonth: number;
      totalReceivable: number;
    };
    paymentStatus: {
      paid: number;
      partial: number;
      unpaid: number;
    };
  };
};

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        boxWidth: 12,
        font: {
          size: 11,
        },
      },
    },
  },
};

export default function DashboardCharts({ charts }: DashboardChartsProps) {
  const stockHealthData = {
    labels: ["Normal", "Low Stock", "Out of Stock"],
    datasets: [
      {
        label: "Products",
        data: [
          charts.stockHealth.normal,
          charts.stockHealth.lowStock,
          charts.stockHealth.outOfStock,
        ],
        backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"],
        borderWidth: 0,
      },
    ],
  };

  const salesData = {
    labels: ["Sales", "Paid", "Remaining This Month", "Total Receivable"],
    datasets: [
      {
        label: "Amount",
        data: [
          charts.salesVsReceivable.sales,
          charts.salesVsReceivable.paid,
          charts.salesVsReceivable.remainingThisMonth,
          charts.salesVsReceivable.totalReceivable,
        ],
        backgroundColor: ["#2563eb", "#22c55e", "#f59e0b", "#ef4444"],
        borderRadius: 6,
      },
    ],
  };

  const movementData = {
    labels: ["Stock In", "Stock Out", "Adjustment"],
    datasets: [
      {
        label: "Quantity",
        data: [
          charts.stockMovementThisMonth.in,
          charts.stockMovementThisMonth.out,
          charts.stockMovementThisMonth.adjustment,
        ],
        backgroundColor: ["#22c55e", "#ef4444", "#f59e0b"],
        borderRadius: 6,
      },
    ],
  };

  const paymentStatusData = {
    labels: ["Paid", "Partial", "Unpaid"],
    datasets: [
      {
        label: "Invoices",
        data: [
          charts.paymentStatus.paid,
          charts.paymentStatus.partial,
          charts.paymentStatus.unpaid,
        ],
        backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="bg-white p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold text-slate-800">
            Stock Health
          </div>
          <div className="text-xs text-slate-500">
            Kondisi stok saat ini: normal, low stock, dan habis.
          </div>
        </div>

        <div className="h-[280px]">
          <Doughnut data={stockHealthData} options={commonOptions} />
        </div>
      </div>

      <div className="bg-white p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold text-slate-800">
            Sales vs Receivables
          </div>
          <div className="text-xs text-slate-500">
            Melihat apakah penjualan benar-benar jadi uang, atau cuma berubah
            jadi piutang. Plot twist yang sering terjadi.
          </div>
        </div>

        <div className="h-[280px]">
          <Bar data={salesData} options={commonOptions} />
        </div>
      </div>

      <div className="bg-white p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold text-slate-800">
            Stock Movement This Month
          </div>
          <div className="text-xs text-slate-500">
            Jumlah pergerakan stok masuk, keluar, dan adjustment bulan ini.
          </div>
        </div>

        <div className="h-[280px]">
          <Bar data={movementData} options={commonOptions} />
        </div>
      </div>

      <div className="bg-white p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold text-slate-800">
            Payment Status
          </div>
          <div className="text-xs text-slate-500">
            Status pembayaran dari invoice terbaru.
          </div>
        </div>

        <div className="h-[280px]">
          <Doughnut data={paymentStatusData} options={commonOptions} />
        </div>
      </div>
    </div>
  );
}
