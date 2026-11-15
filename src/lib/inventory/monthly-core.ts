export function parsePeriod(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error("Periode harus YYYY-MM, contoh 2026-10.");
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5));

  if (year < 2000 || year > 9998) {
    throw new Error("Tahun periode tidak valid.");
  }

  const start = new Date(`${value}-01T00:00:00+07:00`);

  const next =
    month === 12
      ? `${year + 1}-01`
      : `${year}-${String(month + 1).padStart(2, "0")}`;

  const cutoff = new Date(`${next}-01T00:00:00+07:00`);

  return {
    year,
    month,
    start,
    cutoff,
  };
}

export function currentPeriod(now = new Date()) {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);

  const year = wib.getUTCFullYear();
  const month = String(wib.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function nextPeriod(period: string) {
  return currentPeriod(parsePeriod(period).cutoff);
}

export function closingStock(
  currentStock: number,
  laterStockBefore: number,
  laterStockAfter: number,
) {
  const result = currentStock - (laterStockAfter - laterStockBefore);

  if (
    !Number.isSafeInteger(result) ||
    result < -2147483648 ||
    result > 2147483647
  ) {
    throw new Error("Hasil perhitungan stok tidak valid.");
  }

  return result;
}
