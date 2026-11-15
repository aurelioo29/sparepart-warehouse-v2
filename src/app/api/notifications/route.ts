import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/permissions";
import { errorResponse, successResponse } from "@/lib/api-response";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      recipientUserId: auth.user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [items, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),

      prisma.notification.count({
        where,
      }),

      prisma.notification.count({
        where: {
          recipientUserId: auth.user.id,
          isRead: false,
        },
      }),
    ]);

    return successResponse({
      message: "Notifications retrieved successfully",
      data: {
        items,
        unreadCount,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);

    return errorResponse({
      message: "Failed to fetch notifications",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth();

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const body = await req.json();

    const notificationId = body.id as string | undefined;
    const markAll = Boolean(body.markAll);

    if (markAll) {
      await prisma.notification.updateMany({
        where: {
          recipientUserId: auth.user.id,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      return successResponse({
        message: "All notifications marked as read",
        data: null,
      });
    }

    if (!notificationId) {
      return errorResponse({
        message: "Notification id is required",
        status: 400,
      });
    }

    const result = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        recipientUserId: auth.user.id,
      },
      data: {
        isRead: true,
      },
    });

    if (result.count === 0) {
      return errorResponse({
        message: "Notification not found",
        status: 404,
      });
    }

    return successResponse({
      message: "Notification marked as read",
      data: null,
    });
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);

    return errorResponse({
      message: "Failed to update notification",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
