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

type UpdateSalesmanBody = {
  userId?: string | null;
  code?: string;
  name?: string;
  salesmanType?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  commissionType?: string;
  commissionValue?: number | string | null;
  joinDate?: string | null;
  description?: string | null;
  isActive?: boolean;
};

const salesmanTypes = ["INTERNAL", "FREELANCE", "RESELLER", "AGENT"] as const;

const commissionTypes = ["NONE", "PERCENTAGE", "FIXED"] as const;

type SalesmanTypeValue = (typeof salesmanTypes)[number];
type CommissionTypeValue = (typeof commissionTypes)[number];

function isSalesmanType(value: string): value is SalesmanTypeValue {
  return salesmanTypes.includes(value as SalesmanTypeValue);
}

function isCommissionType(value: string): value is CommissionTypeValue {
  return commissionTypes.includes(value as CommissionTypeValue);
}

function parseNullableDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    throw new Error("Commission value harus berupa angka");
  }

  return numberValue;
}

function parseNullableDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Join date tidak valid");
  }

  return date;
}

const salesmanInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
    },
  },
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("salesmen.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const salesman = await prisma.salesman.findUnique({
      where: {
        id,
      },
      include: salesmanInclude,
    });

    if (!salesman) {
      return errorResponse({
        message: "Salesman tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Salesman retrieved successfully",
      data: salesman,
    });
  } catch (error) {
    console.error("GET /api/salesmen/[id] error:", error);

    return errorResponse({
      message: "Failed to fetch salesman",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("salesmen.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;
    const body = (await req.json()) as UpdateSalesmanBody;

    const oldSalesman = await prisma.salesman.findUnique({
      where: {
        id,
      },
      include: salesmanInclude,
    });

    if (!oldSalesman) {
      return errorResponse({
        message: "Salesman tidak ditemukan",
        status: 404,
      });
    }

    const userId = body.userId?.trim() || null;
    const code = body.code?.trim().toUpperCase();
    const name = body.name?.trim();
    const salesmanType = body.salesmanType?.trim() || "FREELANCE";
    const phone = body.phone?.trim() || null;
    const email = body.email?.trim().toLowerCase() || null;
    const address = body.address?.trim() || null;
    const commissionType = body.commissionType?.trim() || "NONE";
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? oldSalesman.isActive;

    if (!code || !name) {
      return errorResponse({
        message: "Code and name are required",
        status: 400,
      });
    }

    if (!isSalesmanType(salesmanType)) {
      return errorResponse({
        message: "Salesman type tidak valid",
        status: 400,
      });
    }

    if (!isCommissionType(commissionType)) {
      return errorResponse({
        message: "Commission type tidak valid",
        status: 400,
      });
    }

    const commissionValue =
      commissionType === "NONE"
        ? null
        : parseNullableDecimal(body.commissionValue);

    const joinDate = parseNullableDate(body.joinDate);

    const duplicateSalesman = await prisma.salesman.findFirst({
      where: {
        id: {
          not: id,
        },
        code,
      },
      select: {
        id: true,
      },
    });

    if (duplicateSalesman) {
      return errorResponse({
        message: "Salesman code sudah digunakan",
        status: 409,
      });
    }

    if (userId) {
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
        },
      });

      if (!user) {
        return errorResponse({
          message: "User tidak ditemukan",
          status: 404,
        });
      }
    }

    const updatedSalesman = await prisma.$transaction(async (tx) => {
      const salesman = await tx.salesman.update({
        where: {
          id,
        },
        data: {
          userId,
          code,
          name,
          salesmanType,
          phone,
          email,
          address,
          commissionType,
          commissionValue,
          joinDate,
          description,
          isActive,
        },
        include: salesmanInclude,
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "UPDATE",
          module: "salesmen",
          resourceType: "salesmen",
          resourceId: salesman.id,
          oldData: oldSalesman,
          newData: salesman,
        },
      });

      return salesman;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "salesmen",
      relatedId: updatedSalesman.id,
      title: "Salesman Updated",
      message: `${currentUser.name || "Someone"} updated salesman ${
        updatedSalesman.name
      }.`,
    });

    return successResponse({
      message: "Salesman updated successfully",
      data: updatedSalesman,
    });
  } catch (error) {
    console.error("PATCH /api/salesmen/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to update salesman",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { searchParams } = new URL(req.url);
    const isPermanent = searchParams.get("permanent") === "true";

    const auth = await requirePermission(
      isPermanent ? "salesmen.delete_permanent" : "salesmen.delete",
    );

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;

    const oldSalesman = await prisma.salesman.findUnique({
      where: {
        id,
      },
      include: salesmanInclude,
    });

    if (!oldSalesman) {
      return errorResponse({
        message: "Salesman tidak ditemukan",
        status: 404,
      });
    }

    if (isPermanent) {
      const deletedSalesman = await prisma.$transaction(async (tx) => {
        const salesman = await tx.salesman.delete({
          where: {
            id,
          },
          include: salesmanInclude,
        });

        await tx.activityLog.create({
          data: {
            userId: currentUser.id,
            action: "DELETE_PERMANENT",
            module: "salesmen",
            resourceType: "salesmen",
            resourceId: salesman.id,
            oldData: oldSalesman,
            newData: Prisma.JsonNull,
          },
        });

        return salesman;
      });

      await notifyAdmins({
        actorUserId: currentUser.id,
        eventType: "DELETE",
        module: "salesmen",
        relatedId: deletedSalesman.id,
        title: "Salesman Permanently Deleted",
        message: `${currentUser.name || "Someone"} permanently deleted salesman ${
          deletedSalesman.name
        }.`,
      });

      return successResponse({
        message: "Salesman permanently deleted successfully",
        data: deletedSalesman,
      });
    }

    if (!oldSalesman.isActive) {
      return errorResponse({
        message: "Salesman sudah inactive",
        status: 400,
      });
    }

    const disabledSalesman = await prisma.$transaction(async (tx) => {
      const salesman = await tx.salesman.update({
        where: {
          id,
        },
        data: {
          isActive: false,
        },
        include: salesmanInclude,
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "INACTIVE",
          module: "salesmen",
          resourceType: "salesmen",
          resourceId: salesman.id,
          oldData: oldSalesman,
          newData: salesman,
        },
      });

      return salesman;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "salesmen",
      relatedId: disabledSalesman.id,
      title: "Salesman Inactivated",
      message: `${currentUser.name || "Someone"} inactivated salesman ${
        disabledSalesman.name
      }.`,
    });

    return successResponse({
      message: "Salesman inactivated successfully",
      data: disabledSalesman,
    });
  } catch (error) {
    console.error("DELETE /api/salesmen/[id] error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return errorResponse({
        message:
          "Salesman tidak bisa dihapus permanent karena masih digunakan oleh data lain. Gunakan inactive saja.",
        status: 409,
        errors: error.message,
      });
    }

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to delete salesman",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
