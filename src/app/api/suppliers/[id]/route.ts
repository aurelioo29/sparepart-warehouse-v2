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

type UpdateSupplierBody = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  description?: string | null;
  isActive?: boolean;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("suppliers.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const supplier = await prisma.supplier.findUnique({
      where: {
        id,
      },
    });

    if (!supplier) {
      return errorResponse({
        message: "Supplier tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Supplier retrieved successfully",
      data: supplier,
    });
  } catch (error) {
    console.error("GET /api/suppliers/[id] error:", error);

    return errorResponse({
      message: "Failed to fetch supplier",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("suppliers.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;
    const body = (await req.json()) as UpdateSupplierBody;

    const oldSupplier = await prisma.supplier.findUnique({
      where: {
        id,
      },
    });

    if (!oldSupplier) {
      return errorResponse({
        message: "Supplier tidak ditemukan",
        status: 404,
      });
    }

    const name = body.name?.trim();
    const phone = body.phone?.trim() || null;
    const email = body.email?.trim().toLowerCase() || null;
    const address = body.address?.trim() || null;
    const contactPerson = body.contactPerson?.trim() || null;
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? oldSupplier.isActive;

    if (!name) {
      return errorResponse({
        message: "Name is required",
        status: 400,
      });
    }

    const updatedSupplier = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.update({
        where: {
          id,
        },
        data: {
          name,
          phone,
          email,
          address,
          contactPerson,
          description,
          isActive,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "UPDATE",
          module: "suppliers",
          resourceType: "suppliers",
          resourceId: supplier.id,
          oldData: oldSupplier,
          newData: supplier,
        },
      });

      return supplier;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "suppliers",
      relatedId: updatedSupplier.id,
      title: "Supplier Updated",
      message: `${currentUser.name || "Someone"} updated supplier ${
        updatedSupplier.name
      }.`,
    });

    return successResponse({
      message: "Supplier updated successfully",
      data: updatedSupplier,
    });
  } catch (error) {
    console.error("PATCH /api/suppliers/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to update supplier",
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
      isPermanent ? "suppliers.delete_permanent" : "suppliers.delete",
    );

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;

    const { id } = await context.params;

    const oldSupplier = await prisma.supplier.findUnique({
      where: {
        id,
      },
    });

    if (!oldSupplier) {
      return errorResponse({
        message: "Supplier tidak ditemukan",
        status: 404,
      });
    }

    if (isPermanent) {
      const deletedSupplier = await prisma.$transaction(async (tx) => {
        const supplier = await tx.supplier.delete({
          where: {
            id,
          },
        });

        await tx.activityLog.create({
          data: {
            userId: currentUser.id,
            action: "DELETE_PERMANENT",
            module: "suppliers",
            resourceType: "suppliers",
            resourceId: supplier.id,
            oldData: oldSupplier,
            newData: Prisma.JsonNull,
          },
        });

        return supplier;
      });

      await notifyAdmins({
        actorUserId: currentUser.id,
        eventType: "DELETE",
        module: "suppliers",
        relatedId: deletedSupplier.id,
        title: "Supplier Permanently Deleted",
        message: `${currentUser.name || "Someone"} permanently deleted supplier ${
          deletedSupplier.name
        }.`,
      });

      return successResponse({
        message: "Supplier permanently deleted successfully",
        data: deletedSupplier,
      });
    }

    if (!oldSupplier.isActive) {
      return errorResponse({
        message: "Supplier sudah inactive",
        status: 400,
      });
    }

    const disabledSupplier = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.update({
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
          module: "suppliers",
          resourceType: "suppliers",
          resourceId: supplier.id,
          oldData: oldSupplier,
          newData: supplier,
        },
      });

      return supplier;
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "suppliers",
      relatedId: disabledSupplier.id,
      title: "Supplier Inactivated",
      message: `${currentUser.name || "Someone"} inactivated supplier ${
        disabledSupplier.name
      }.`,
    });

    return successResponse({
      message: "Supplier inactivated successfully",
      data: disabledSupplier,
    });
  } catch (error) {
    console.error("DELETE /api/suppliers/[id] error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return errorResponse({
        message:
          "Supplier tidak bisa dihapus permanent karena masih digunakan oleh data lain. Gunakan inactive saja.",
        status: 409,
        errors: error.message,
      });
    }

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to delete supplier",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
