import { timingSafeEqual } from "node:crypto";

import { closePendingInventoryMonths } from "@/lib/inventory/monthly-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.INVENTORY_CRON_SECRET;

  if (!secret || secret.length < 32) {
    return Response.json(
      {
        success: false,
        message: "INVENTORY_CRON_SECRET belum dikonfigurasi dengan benar.",
      },
      {
        status: 503,
      },
    );
  }

  const authorization = Buffer.from(req.headers.get("authorization") || "");

  const expected = Buffer.from(`Bearer ${secret}`);

  const valid =
    authorization.length === expected.length &&
    timingSafeEqual(authorization, expected);

  if (!valid) {
    return Response.json(
      {
        success: false,
        message: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const result = await closePendingInventoryMonths();

    return Response.json(
      {
        success: true,
        message: "Proses rekap stok bulanan selesai.",
        data: result,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Monthly inventory job failed:", error);

    return Response.json(
      {
        success: false,
        message: "Rekap stok gagal. Periksa log server lalu jalankan ulang.",
      },
      {
        status: 500,
      },
    );
  }
}
