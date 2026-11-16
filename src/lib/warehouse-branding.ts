import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";

export const getWarehouseInfoForLayout = cache(async () => {
  try {
    return await prisma.warehouseInfo.findFirst({
      orderBy: { createdAt: "asc" },
      select: {
        storeName: true,
        logoUrl: true,
        city: true,
        province: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    console.error("Failed to load warehouse info for layout:", error);
    return null;
  }
});

export function getWarehouseSiteName(storeName?: string | null) {
  return (
    storeName?.trim() ||
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    "Sparepart Warehouse"
  );
}
