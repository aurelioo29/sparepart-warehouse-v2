import { prisma } from "@/lib/prisma";

export type NotificationEventType = "CREATE" | "UPDATE" | "DELETE";

type CreateNotificationParams = {
  recipientUserId: string;
  actorUserId?: string | null;
  title: string;
  message: string;
  eventType: NotificationEventType;
  module: string;
  relatedId?: string | null;
};

type NotifyAdminsParams = {
  actorUserId?: string | null;
  title: string;
  message: string;
  eventType: NotificationEventType;
  module: string;
  relatedId?: string | null;
  includeActor?: boolean;
};

export async function createNotification({
  recipientUserId,
  actorUserId,
  title,
  message,
  eventType,
  module,
  relatedId,
}: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      recipientUserId,
      actorUserId: actorUserId || null,
      title,
      message,
      eventType,
      module,
      relatedId: relatedId || null,
      isRead: false,
    },
  });
}

export async function notifyAdmins({
  actorUserId,
  title,
  message,
  eventType,
  module,
  relatedId,
  includeActor = true,
}: NotifyAdminsParams) {
  const recipients = await prisma.user.findMany({
    where: {
      isActive: true,

      ...(actorUserId && !includeActor
        ? {
            id: {
              not: actorUserId,
            },
          }
        : {}),

      OR: [
        {
          role: {
            slug: "superadmin",
          },
        },
        {
          role: {
            slug: "owner",
          },
        },
        {
          role: {
            slug: "admin-gudang",
          },
        },
        {
          role: {
            rolePermissions: {
              some: {
                permission: {
                  key: "notifications.view",
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  const uniqueRecipientIds = Array.from(
    new Set(recipients.map((recipient) => recipient.id)),
  );

  if (uniqueRecipientIds.length === 0) {
    return {
      count: 0,
    };
  }

  await prisma.notification.createMany({
    data: uniqueRecipientIds.map((recipientUserId) => ({
      recipientUserId,
      actorUserId: actorUserId || null,
      title,
      message,
      eventType,
      module,
      relatedId: relatedId || null,
      isRead: false,
    })),
  });

  return {
    count: uniqueRecipientIds.length,
  };
}

export function buildCrudNotificationMessage(params: {
  eventType: NotificationEventType;
  module: string;
  label?: string | null;
  actorName?: string | null;
}) {
  const actorName = params.actorName || "Someone";
  const label = params.label || "data";

  if (params.eventType === "CREATE") {
    return `${actorName} created ${label} in ${params.module}.`;
  }

  if (params.eventType === "UPDATE") {
    return `${actorName} updated ${label} in ${params.module}.`;
  }

  return `${actorName} deleted ${label} from ${params.module}.`;
}
