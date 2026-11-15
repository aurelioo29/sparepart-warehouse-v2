import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return errorResponse({
        message: "Silakan login terlebih dahulu",
        status: 401,
      });
    }

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        sku: true,
        name: true,
        currentStock: true,
        sellingPrice: true,

        warehouseId: true,
        rackLocationId: true,

        unit: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },

        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },

        rackLocation: {
          select: {
            id: true,
            warehouseId: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return successResponse({
      message: "Product options retrieved successfully",
      data: products.map((product) => ({
        ...product,
        sellingPrice: Number(product.sellingPrice || 0),
      })),
    });
  } catch (error) {
    console.error("GET /api/products/options error:", error);

    return errorResponse({
      message: "Failed to fetch product options",
      status: 500,
    });
  }
}
