import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { generateKngOrderNumber, parseKngOrderDate } from "@/lib/kng-orders";

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("kng-orders.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { searchParams } = new URL(req.url);
    const orderDate = parseKngOrderDate(searchParams.get("orderDate"));

    const orderNumber = await prisma.$transaction(async (tx) => {
      return generateKngOrderNumber(tx, orderDate);
    });

    return successResponse({
      message: "KNG order number generated successfully",
      data: {
        orderNumber,
      },
    });
  } catch (error) {
    console.error("GET /api/kng-orders/next-number error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate KNG order number",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
