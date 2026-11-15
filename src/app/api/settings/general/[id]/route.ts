import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateGeneralSettingBody = {
  key?: string;
  value?: unknown;
  type?: string;
  group?: string;
  description?: string | null;
  isPublic?: boolean;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("settings.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;
    const body = (await req.json()) as UpdateGeneralSettingBody;

    const oldSetting = await prisma.generalSetting.findUnique({
      where: {
        id,
      },
    });

    if (!oldSetting) {
      return errorResponse({
        message: "General setting tidak ditemukan",
        status: 404,
      });
    }

    const key = body.key?.trim().toLowerCase();
    const type = body.type?.trim().toLowerCase();
    const groupName = body.group?.trim().toLowerCase();
    const description = body.description?.trim() || null;
    const isPublic = body.isPublic ?? false;

    if (!key || !type || !groupName) {
      return errorResponse({
        message: "Key, type, and group are required",
        status: 400,
      });
    }

    const duplicateSetting = await prisma.generalSetting.findFirst({
      where: {
        id: {
          not: id,
        },
        key,
      },
      select: {
        id: true,
      },
    });

    if (duplicateSetting) {
      return errorResponse({
        message: "Setting key sudah digunakan",
        status: 409,
      });
    }

    const updatedSetting = await prisma.generalSetting.update({
      where: {
        id,
      },
      data: {
        key,
        value: body.value as Prisma.InputJsonValue,
        type,
        group: groupName,
        description,
        isPublic,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "UPDATE",
        module: "general_settings",
        resourceType: "general_settings",
        resourceId: updatedSetting.id,
        oldData: oldSetting,
        newData: updatedSetting,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "UPDATE",
      module: "general_settings",
      relatedId: updatedSetting.id,
      title: "General Setting Updated",
      message: `${auth.user.name || "Someone"} updated setting ${
        updatedSetting.key
      }.`,
    });

    return successResponse({
      message: "General setting updated successfully",
      data: updatedSetting,
    });
  } catch (error) {
    console.error("PATCH /api/settings/general/[id] error:", error);

    return errorResponse({
      message: "Failed to update general setting",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("settings.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const oldSetting = await prisma.generalSetting.findUnique({
      where: {
        id,
      },
    });

    if (!oldSetting) {
      return errorResponse({
        message: "General setting tidak ditemukan",
        status: 404,
      });
    }

    const deletedSetting = await prisma.generalSetting.delete({
      where: {
        id,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "DELETE",
        module: "general_settings",
        resourceType: "general_settings",
        resourceId: deletedSetting.id,
        oldData: oldSetting,
        newData: deletedSetting,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "DELETE",
      module: "general_settings",
      relatedId: deletedSetting.id,
      title: "General Setting Deleted",
      message: `${auth.user.name || "Someone"} deleted setting ${
        deletedSetting.key
      }.`,
    });

    return successResponse({
      message: "General setting deleted successfully",
      data: deletedSetting,
    });
  } catch (error) {
    console.error("DELETE /api/settings/general/[id] error:", error);

    return errorResponse({
      message: "Failed to delete general setting",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
