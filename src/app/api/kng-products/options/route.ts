import { Prisma } from "@/../prisma/generated/prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";

export async function GET(req: Request) {
  try {
    // Semua user yang sudah login boleh mengambil pilihan produk.
    const session = await auth();

    if (!session?.user) {
      return errorResponse({
        message: "Silakan login terlebih dahulu",
        status: 401,
      });
    }

    const { searchParams } = new URL(req.url);

    const jenis = (searchParams.get("jenis") || "").trim();
    const search = (searchParams.get("search") || "").trim();

    const where: Prisma.KngProductWhereInput = {
      isActive: true,
    };

    if (jenis) {
      where.jenis = jenis;
    }

    if (search) {
      where.OR = [
        {
          jenis: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          partNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    const [jenisOptions, products] = await prisma.$transaction([
      prisma.kngProduct.findMany({
        where: {
          isActive: true,
        },
        distinct: ["jenis"],
        select: {
          jenis: true,
        },
        orderBy: {
          jenis: "asc",
        },
      }),

      prisma.kngProduct.findMany({
        where,
        select: {
          id: true,
          jenis: true,
          partNumber: true,
          hargaJkt: true,
        },
        orderBy: [
          {
            jenis: "asc",
          },
          {
            partNumber: "asc",
          },
        ],
      }),
    ]);

    return successResponse({
      message: "Pilihan produk KNG berhasil diambil",
      data: {
        jenisOptions: jenisOptions.map((item) => ({
          label: item.jenis,
          value: item.jenis,
        })),
        products: products.map((item) => ({
          label: item.partNumber,
          value: item.id,
          jenis: item.jenis,
          partNumber: item.partNumber,
          hargaJkt: item.hargaJkt.toString(),
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/kng-products/options error:", error);

    return errorResponse({
      message: "Gagal mengambil pilihan produk KNG",
      status: 500,
    });
  }
}
