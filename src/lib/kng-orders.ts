import { Prisma } from "@/../prisma/generated/prisma/client";

export const KNG_ORDER_STATUSES = ["DRAFT", "POSTED", "CANCELLED"] as const;

export type KngOrderStatusValue = (typeof KNG_ORDER_STATUSES)[number];

// =========================================================
// STATUS
// =========================================================

export function isKngOrderStatus(value: string): value is KngOrderStatusValue {
  return KNG_ORDER_STATUSES.includes(value as KngOrderStatusValue);
}

// =========================================================
// JSON
// =========================================================

export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// =========================================================
// DATE
// =========================================================

export function parseKngOrderDate(value?: string | Date | null) {
  if (!value) {
    return new Date();
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error("Tanggal order tidak valid");
    }

    return value;
  }

  const dateOnly = value.split("T")[0];

  const [year, month, day] = dateOnly.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error("Tanggal order tidak valid");
  }

  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal order tidak valid");
  }

  return date;
}

// =========================================================
// ORDER NUMBER
//
// FORMAT:
//
// 002/KNG-08/2026
// 003/KNG-08/2026
//
// Bulan berikutnya:
//
// 001/KNG-09/2026
// 002/KNG-09/2026
// =========================================================

function padKngSequence(value: number) {
  return String(value).padStart(3, "0");
}

function padKngMonth(value: number) {
  return String(value).padStart(2, "0");
}

// =========================================================
// PARSE SEQUENCE
// =========================================================

function parseKngSequence(orderNumber: string): number {
  const match = orderNumber.match(/^(\d{3,})\/KNG-(\d{2})\/(\d{4})$/);

  if (!match) {
    return 0;
  }

  return Number(match[1] || 0);
}

// =========================================================
// START SEQUENCE
// =========================================================

function getKngSequenceStart(orderDate: Date): number {
  const year = orderDate.getFullYear();
  const month = orderDate.getMonth() + 1;

  /**
   * Khusus Agustus 2026.
   *
   * Nomor:
   * 001/KNG-08/2026
   *
   * sudah dibuat manual sebelumnya.
   *
   * Maka sistem mulai dari:
   * 002/KNG-08/2026
   */
  if (year === 2026 && month === 8) {
    return 2;
  }

  /**
   * Bulan lain selalu mulai 001
   */
  return 1;
}

// =========================================================
// GENERATE ORDER NUMBER
// =========================================================

export async function generateKngOrderNumber(
  tx: Prisma.TransactionClient,
  orderDate: Date,
) {
  const year = orderDate.getFullYear();

  const month = orderDate.getMonth() + 1;

  const formattedMonth = padKngMonth(month);

  /**
   * Contoh:
   *
   * /KNG-08/2026
   * /KNG-09/2026
   */
  const suffix = `/KNG-${formattedMonth}/${year}`;

  /**
   * Cari berdasarkan NOMOR ORDER,
   * bukan berdasarkan createdAt.
   *
   * Jadi sequence benar-benar dipisahkan
   * berdasarkan bulan pada nomor dokumen.
   */
  const existingOrders = await tx.kngOrder.findMany({
    where: {
      orderNumber: {
        endsWith: suffix,
      },
    },

    select: {
      orderNumber: true,
    },
  });

  /**
   * Cari sequence tertinggi.
   */
  let highestSequence = 0;

  for (const order of existingOrders) {
    const sequence = parseKngSequence(order.orderNumber);

    if (sequence > highestSequence) {
      highestSequence = sequence;
    }
  }

  /**
   * Sequence awal bulan.
   *
   * Agustus 2026 = 2
   * lainnya = 1
   */
  const sequenceStart = getKngSequenceStart(orderDate);

  /**
   * Kalau bulan tersebut belum ada order:
   *
   * Agustus 2026 -> 002
   * September -> 001
   *
   * Kalau sudah ada:
   *
   * 001 -> 002
   * 002 -> 003
   */
  const nextSequence =
    highestSequence > 0 ? highestSequence + 1 : sequenceStart;

  const formattedSequence = padKngSequence(nextSequence);

  return `${formattedSequence}/KNG-${formattedMonth}/${year}`;
}

// =========================================================
// PRICE
// =========================================================

export function calculateHargaNetto(hargaJkt: number, discountPercent: number) {
  return Math.round(hargaJkt - (hargaJkt * discountPercent) / 100);
}
