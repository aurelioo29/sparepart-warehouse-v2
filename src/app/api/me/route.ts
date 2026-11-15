import { requireAuth } from "@/lib/auth/permissions";
import { errorResponse, successResponse } from "@/lib/api-response";

export async function GET() {
  const auth = await requireAuth();

  if (!auth.authorized) {
    return errorResponse({
      message: auth.message,
      status: auth.status,
    });
  }

  return successResponse({
    message: "Current user retrieved successfully",
    data: auth.user,
  });
}
