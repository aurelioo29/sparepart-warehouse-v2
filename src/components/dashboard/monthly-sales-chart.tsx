"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { BarChartOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, InputNumber, Skeleton } from "antd";

type MonthlySalesItem = {
  month: number;
  label: string;
  shortLabel: string;
  totalSales: number;
  totalInvoices: number;
  isFuture: boolean;
  isCurrentMonth: boolean;
};

type MonthlySalesData = {
  year: number;
  currentYear: number;
  currentMonth: number;
  items: MonthlySalesItem[];
  summary: {
    totalSales: number;
    totalInvoices: number;
    highestMonth: {
      month: number;
      label: string;
      totalSales: number;
    } | null;
  };
};

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatAxis(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000_000) {
    return `${numberFormatter.format(value / 1_000_000_000)} M`;
  }

  if (absolute >= 1_000_000) {
    return `${numberFormatter.format(value / 1_000_000)} jt`;
  }

  if (absolute >= 1_000) {
    return `${numberFormatter.format(value / 1_000)} rb`;
  }

  return formatNumber(value);
}

function getCurrentWibYear() {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
    }).format(new Date()),
  );
}

function getAxisScale(values: number[]) {
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);

  const range = maximum - minimum || 1;
  const roughStep = range / 4;

  const magnitude = 10 ** Math.floor(Math.log10(roughStep));

  const normalized = roughStep / magnitude;

  const multiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  const step = multiplier * magnitude;

  const min = Math.floor(minimum / step) * step;
  const max = Math.ceil(maximum / step) * step;

  const safeMax = max === min ? min + step : max;

  const ticks: number[] = [];

  const count = Math.round((safeMax - min) / step);

  for (let index = 0; index <= count; index += 1) {
    ticks.push(min + index * step);
  }

  return {
    min,
    max: safeMax,
    ticks,
  };
}

export default function MonthlySalesChart() {
  const chartTitleId = useId();

  const [currentYear, setCurrentYear] = useState<number | null>(null);

  const [year, setYear] = useState<number | null>(null);

  const [data, setData] = useState<MonthlySalesData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    const initialYear = getCurrentWibYear();

    setCurrentYear(initialYear);
    setYear(initialYear);
  }, []);

  const fetchTrend = useCallback(async (selectedYear: number) => {
    requestController.current?.abort();

    const controller = new AbortController();
    requestController.current = controller;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/dashboard/sales-trend?year=${selectedYear}`,
        {
          cache: "no-store",
          signal: controller.signal,
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Grafik penjualan belum bisa dimuat");
      }

      if (controller.signal.aborted) return;

      const nextData: MonthlySalesData = result.data;

      setData(nextData);

      setSelectedMonth(
        nextData.year === nextData.currentYear
          ? nextData.currentMonth
          : (nextData.summary.highestMonth?.month ?? 12),
      );
    } catch (error) {
      if (controller.signal.aborted) return;

      setError(
        error instanceof Error
          ? error.message
          : "Grafik penjualan belum bisa dimuat",
      );
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (year === null) return;

    void fetchTrend(year);

    return () => {
      requestController.current?.abort();
    };
  }, [year, fetchTrend]);

  const axis = useMemo(
    () =>
      getAxisScale(
        (data?.items || [])
          .filter((item) => !item.isFuture)
          .map((item) => item.totalSales),
      ),
    [data],
  );

  const selectedItem =
    data?.items.find((item) => item.month === selectedMonth) || null;

  const width = 960;
  const height = 300;

  const padding = {
    top: 22,
    right: 18,
    bottom: 44,
    left: 78,
  };

  const plotWidth = width - padding.left - padding.right;

  const plotHeight = height - padding.top - padding.bottom;

  const slotWidth = plotWidth / 12;
  const barWidth = 34;

  function yPosition(value: number) {
    return (
      padding.top + ((axis.max - value) / (axis.max - axis.min)) * plotHeight
    );
  }

  const zeroY = yPosition(0);

  const hasInvoices = (data?.summary.totalInvoices || 0) > 0;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between md:px-5 md:pt-5">
        <div>
          <h2 className="m-0 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <BarChartOutlined className="text-blue-500" />
            Tren penjualan per bulan
          </h2>

          <p className="mb-0 mt-1 text-xs leading-5 text-slate-500">
            Total nilai penjualan Januari–Desember.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Tahun</span>

          <InputNumber
            aria-label="Tahun grafik penjualan"
            size="small"
            min={2000}
            max={currentYear ?? undefined}
            precision={0}
            value={year}
            changeOnWheel={false}
            onChange={(value) => {
              if (
                value === null ||
                currentYear === null ||
                !Number.isInteger(value) ||
                value < 2000 ||
                value > currentYear
              ) {
                return;
              }

              setYear(value);
            }}
            style={{ width: 90 }}
          />

          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={year === null}
            aria-label="Perbarui grafik penjualan"
            onClick={() => {
              if (year !== null) {
                void fetchTrend(year);
              }
            }}
          />
        </div>
      </div>

      <div className="px-4 pb-4 pt-4 md:px-5 md:pb-5">
        {error ? (
          <Alert
            type="error"
            showIcon
            message={error}
            action={
              <Button
                size="small"
                disabled={year === null}
                onClick={() => {
                  if (year !== null) {
                    void fetchTrend(year);
                  }
                }}
              >
                Coba lagi
              </Button>
            }
          />
        ) : loading ? (
          <div className="py-5">
            <Skeleton active title={false} paragraph={{ rows: 7 }} />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-3.5 md:grid-cols-3 md:p-4">
              <div>
                <div className="text-[11px] text-slate-500">
                  Total penjualan {data.year}
                </div>

                <div className="mt-1 text-base font-bold text-slate-900 [overflow-wrap:anywhere] md:text-xl">
                  {formatCurrency(data.summary.totalSales)}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500">Jumlah faktur</div>

                <div className="mt-1 text-base font-bold text-slate-900 md:text-xl">
                  {formatNumber(data.summary.totalInvoices)}
                </div>
              </div>

              <div className="col-span-2 md:col-span-1">
                <div className="text-[11px] text-slate-500">
                  Penjualan tertinggi
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {data.summary.highestMonth ? (
                    <>
                      {data.summary.highestMonth.label}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {formatCurrency(data.summary.highestMonth.totalSales)}
                      </span>
                    </>
                  ) : (
                    "Belum ada penjualan"
                  )}
                </div>
              </div>
            </div>

            {hasInvoices ? (
              <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>Nilai penjualan dalam rupiah</span>

                  <span className="md:hidden">
                    Geser grafik untuk melihat semua bulan
                  </span>
                </div>

                <div className="mt-2 overflow-x-auto pb-1">
                  <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="block w-full min-w-[760px]"
                    role="group"
                    aria-labelledby={chartTitleId}
                  >
                    <title id={chartTitleId}>
                      Tren penjualan per bulan tahun {data.year}. Pilih batang
                      untuk melihat detail penjualan.
                    </title>

                    {axis.ticks.map((tick) => {
                      const y = yPosition(tick);

                      return (
                        <g key={tick}>
                          <line
                            x1={padding.left}
                            y1={y}
                            x2={width - padding.right}
                            y2={y}
                            stroke={tick === 0 ? "#cbd5e1" : "#e2e8f0"}
                            strokeDasharray={tick === 0 ? undefined : "4 5"}
                          />

                          <text
                            x={padding.left - 12}
                            y={y + 4}
                            textAnchor="end"
                            fontSize="11"
                            fill="#94a3b8"
                          >
                            {formatAxis(tick)}
                          </text>
                        </g>
                      );
                    })}

                    {data.items.map((item, index) => {
                      const centerX =
                        padding.left + index * slotWidth + slotWidth / 2;

                      const valueY = yPosition(item.totalSales);

                      const barY = Math.min(valueY, zeroY);

                      const barHeight = Math.abs(zeroY - valueY);

                      const selected = selectedMonth === item.month;

                      const color = selected
                        ? "#1d4ed8"
                        : item.isCurrentMonth
                          ? "#93c5fd"
                          : "#3b82f6";

                      const detail = item.isFuture
                        ? `${item.label}: belum berjalan`
                        : `${item.label}: ${formatCurrency(
                            item.totalSales,
                          )}, ${formatNumber(item.totalInvoices)} faktur${
                            item.isCurrentMonth ? ", bulan masih berjalan" : ""
                          }`;

                      return (
                        <g
                          key={item.month}
                          role="button"
                          tabIndex={0}
                          aria-label={detail}
                          aria-pressed={selected}
                          className="cursor-pointer"
                          onClick={() => {
                            setSelectedMonth(item.month);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedMonth(item.month);
                            }
                          }}
                        >
                          <title>{detail}</title>

                          <rect
                            x={padding.left + index * slotWidth + 3}
                            y={padding.top}
                            width={slotWidth - 6}
                            height={plotHeight}
                            rx="8"
                            fill={selected ? "#eff6ff" : "transparent"}
                          />

                          {item.isFuture ? (
                            <rect
                              x={centerX - barWidth / 2}
                              y={zeroY - 5}
                              width={barWidth}
                              height={5}
                              rx="2"
                              fill="#f8fafc"
                              stroke="#cbd5e1"
                              strokeDasharray="3 3"
                            />
                          ) : item.totalSales === 0 ? (
                            <line
                              x1={centerX - barWidth / 2}
                              y1={zeroY}
                              x2={centerX + barWidth / 2}
                              y2={zeroY}
                              stroke={color}
                              strokeWidth="3"
                            />
                          ) : (
                            <rect
                              x={centerX - barWidth / 2}
                              y={barY}
                              width={barWidth}
                              height={Math.max(barHeight, 1)}
                              rx="5"
                              fill={color}
                            />
                          )}

                          <text
                            x={centerX}
                            y={padding.top + plotHeight + 25}
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight={selected ? 700 : 400}
                            fill={
                              item.isFuture
                                ? "#cbd5e1"
                                : selected
                                  ? "#1d4ed8"
                                  : "#64748b"
                            }
                          >
                            {item.shortLabel}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-blue-500" />
                    Penjualan
                  </span>

                  {data.year === data.currentYear ? (
                    <>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm bg-blue-300" />
                        Bulan berjalan
                      </span>

                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm border border-dashed border-slate-300" />
                        Belum berjalan
                      </span>
                    </>
                  ) : null}
                </div>

                {selectedItem ? (
                  <div
                    className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-3"
                    aria-live="polite"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        {selectedItem.label} {data.year}
                      </span>

                      <span className="text-xs text-slate-500">
                        {selectedItem.isFuture
                          ? "Belum berjalan"
                          : selectedItem.isCurrentMonth
                            ? "Bulan masih berjalan"
                            : `${formatNumber(
                                selectedItem.totalInvoices,
                              )} faktur`}
                      </span>
                    </div>

                    {!selectedItem.isFuture ? (
                      <div className="mt-1 text-lg font-bold text-blue-700">
                        {formatCurrency(selectedItem.totalSales)}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="py-8">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={`Belum ada faktur penjualan pada tahun ${data.year}`}
                />
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
