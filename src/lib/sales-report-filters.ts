import type { Prisma } from "@/../prisma/generated/prisma/client";

export type SalesDateRange = {
  start: Date;
  endExclusive: Date;
};

// The sale form sends YYYY-MM-DD; the sales API stores new Date(YYYY-MM-DD).
// Therefore saleDate is a business date represented by midnight UTC.
// Compare its UTC calendar date; do not shift a business date by server timezone.
export function getSaleDateParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

// WIB determines which business day/month is "today".
export function getWibDateParts(date = new Date()) {
  return getSaleDateParts(new Date(date.getTime() + 7 * 60 * 60 * 1000));
}

export function getSalesMonthRange(year: number, month: number): SalesDateRange {
  if (!Number.isInteger(year) || year < 2000 || year > 9998 ||
      !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Tahun atau bulan penjualan tidak valid");
  }
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    endExclusive: new Date(Date.UTC(year, month, 1)),
  };
}

export function getSalesDayRange(now = new Date()): SalesDateRange {
  const { year, month, day } = getWibDateParts(now);
  return {
    start: new Date(Date.UTC(year, month - 1, day)),
    endExclusive: new Date(Date.UTC(year, month - 1, day + 1)),
  };
}

// Use a positive allowlist: CANCELLED and any other non-posted status are excluded.
export function createPostedSalesWhere(
  range?: SalesDateRange,
  salesmanId?: string,
): Prisma.SaleWhereInput {
  return {
    status: "POSTED",
    ...(range ? { saleDate: { gte: range.start, lt: range.endExclusive } } : {}),
    ...(salesmanId ? { salesmanId } : {}),
  };
}

// Inclusive calendar month span, represented as a half-open database interval.
export function getSalesMonthSpan(monthFrom: string, monthTo: string): SalesDateRange {
  const parseMonth = (value: string) => {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
    if (!match) throw new Error("Periode KNG harus menggunakan format YYYY-MM");
    return getSalesMonthRange(Number(match[1]), Number(match[2]));
  };
  const first = parseMonth(monthFrom);
  const last = parseMonth(monthTo);
  if (first.start > last.start) {
    throw new Error("Bulan awal KNG tidak boleh melebihi bulan akhir");
  }
  return { start: first.start, endExclusive: last.endExclusive };
}
