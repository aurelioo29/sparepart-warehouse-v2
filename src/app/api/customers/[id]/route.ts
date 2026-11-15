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

type UpdateCustomerBody = {
  name?: string;
  customerType?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  creditLimit?: number | string | null;
  paymentTermDays?: number | string | null;
  description?: string | null;
  isActive?: boolean;
};

const customerTypes = [
  "INDIVIDUAL",
  "WORKSHOP",
  "STORE",
  "RESELLER",
  "COMPANY",
  "OTHER",
] as const;

type CustomerTypeValue = (typeof customerTypes)[number];

function isCustomerType(value: string): value is CustomerTypeValue {
  return customerTypes.includes(value as CustomerTypeValue);
}

function parseNullableDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    throw new Error("Credit limit harus berupa angka");
  }

  return numberValue;
}

function parseNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue)) {
    throw new Error("Payment term days harus berupa angka bulat");
  }

  return numberValue;
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("customers.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const customer = await prisma.customer.findUnique({
      where: {
        id,
      },
    });

    if (!customer) {
      return errorResponse({
        message: "Customer tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Customer retrieved successfully",
      data: customer,
    });
  } catch (error) {
    console.error("GET /api/customers/[id] error:", error);

    return errorResponse({
      message: "Failed to fetch customer",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("customers.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;
    const body = (await req.json()) as UpdateCustomerBody;

    const oldCustomer = await prisma.customer.findUnique({
      where: {
        id,
      },
    });

    if (!oldCustomer) {
      return errorResponse({
        message: "Customer tidak ditemukan",
        status: 404,
      });
    }

    const name = body.name?.trim();
    const customerType = body.customerType?.trim() || "INDIVIDUAL";
    const phone = body.phone?.trim() || null;
    const email = body.email?.trim().toLowerCase() || null;
    const address = body.address?.trim() || null;
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? oldCustomer.isActive;

    if (!name) {
      return errorResponse({
        message: "Name is required",
        status: 400,
      });
    }

    if (!isCustomerType(customerType)) {
      return errorResponse({
        message: "Customer type tidak valid",
        status: 400,
      });
    }

    const creditLimit = parseNullableDecimal(body.creditLimit);
    const paymentTermDays = parseNullableInteger(body.paymentTermDays);

    const updatedCustomer = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: {
          id,
        },
        data: {
          name,
          customerType,
          phone,
          email,
          address,
          creditLimit,
          paymentTermDays,
          description,
          isActive,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "UPDATE",
          module: "customers",
          resourceType: "customers",
          resourceId: customer.id,
          oldData: oldCustomer,
          newData: customer,
        },
      });

      return customer;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "customers",
      relatedId: updatedCustomer.id,
      title: "Customer Updated",
      message: `${currentUser.name || "Someone"} updated customer ${
        updatedCustomer.name
      }.`,
    });

    return successResponse({
      message: "Customer updated successfully",
      data: updatedCustomer,
    });
  } catch (error) {
    console.error("PATCH /api/customers/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to update customer",
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
      isPermanent ? "customers.delete_permanent" : "customers.delete",
    );

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;

    const oldCustomer = await prisma.customer.findUnique({
      where: {
        id,
      },
    });

    if (!oldCustomer) {
      return errorResponse({
        message: "Customer tidak ditemukan",
        status: 404,
      });
    }

    if (isPermanent) {
      const deletedCustomer = await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.delete({
          where: {
            id,
          },
        });

        await tx.activityLog.create({
          data: {
            userId: currentUser.id,
            action: "DELETE_PERMANENT",
            module: "customers",
            resourceType: "customers",
            resourceId: customer.id,
            oldData: oldCustomer,
            newData: Prisma.JsonNull,
          },
        });

        return customer;
      });

      await notifyAdmins({
        actorUserId: currentUser.id,
        eventType: "DELETE",
        module: "customers",
        relatedId: deletedCustomer.id,
        title: "Customer Permanently Deleted",
        message: `${currentUser.name || "Someone"} permanently deleted customer ${
          deletedCustomer.name
        }.`,
      });

      return successResponse({
        message: "Customer permanently deleted successfully",
        data: deletedCustomer,
      });
    }

    if (!oldCustomer.isActive) {
      return errorResponse({
        message: "Customer sudah inactive",
        status: 400,
      });
    }

    const disabledCustomer = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: {
          id,
        },
        data: {
          isActive: false,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "INACTIVE",
          module: "customers",
          resourceType: "customers",
          resourceId: customer.id,
          oldData: oldCustomer,
          newData: customer,
        },
      });

      return customer;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "customers",
      relatedId: disabledCustomer.id,
      title: "Customer Inactivated",
      message: `${currentUser.name || "Someone"} inactivated customer ${
        disabledCustomer.name
      }.`,
    });

    return successResponse({
      message: "Customer inactivated successfully",
      data: disabledCustomer,
    });
  } catch (error) {
    console.error("DELETE /api/customers/[id] error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return errorResponse({
        message:
          "Customer tidak bisa dihapus permanent karena masih digunakan oleh data lain. Gunakan inactive saja.",
        status: 409,
        errors: error.message,
      });
    }

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to delete customer",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
