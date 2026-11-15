import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const barcode = (searchParams.get("barcode") || "").trim();

    if (!barcode) {
      return errorResponse({
        message: "Barcode wajib diisi",
        status: 400,
      });
    }

    const rackLocation = await prisma.rackLocation.findFirst({
      where: {
        barcodeValue: barcode,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        barcodeValue: true,
        description: true,
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!rackLocation) {
      return errorResponse({
        message: "Rack location tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Rack location found",
      data: rackLocation,
    });
  } catch (error) {
    console.error("GET /api/public/rack-locations/scan error:", error);

    return errorResponse({
      message: "Failed to scan rack location",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
