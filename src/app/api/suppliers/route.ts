import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type CreateSupplierBody = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  description?: string | null;
  isActive?: boolean;
};

function getSupplierOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.SupplierOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "name":
      return { name: order };

    case "phone":
      return { phone: order };

    case "email":
      return { email: order };

    case "contactPerson":
      return { contactPerson: order };

    case "isActive":
      return { isActive: order };

    case "updatedAt":
      return { updatedAt: order };

    case "createdAt":
    default:
      return { createdAt: order };
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("suppliers.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);

    const search = (searchParams.get("search") || "").trim();
    const isActive = (searchParams.get("isActive") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const skip = (page - 1) * limit;

    const where: Prisma.SupplierWhereInput = {};

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          contactPerson: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          address: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (isActive === "true") {
      where.isActive = true;
    }

    if (isActive === "false") {
      where.isActive = false;
    }

    const [items, total] = await prisma.$transaction([
      prisma.supplier.findMany({
        where,
        orderBy: getSupplierOrderBy(sortBy, sortOrder),
        skip,
        take: limit,
      }),

      prisma.supplier.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Suppliers retrieved successfully",
      data: {
        items,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/suppliers error:", error);

    return errorResponse({
      message: "Failed to fetch suppliers",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("suppliers.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const body = (await req.json()) as CreateSupplierBody;

    const name = body.name?.trim();
    const phone = body.phone?.trim() || null;
    const email = body.email?.trim().toLowerCase() || null;
    const address = body.address?.trim() || null;
    const contactPerson = body.contactPerson?.trim() || null;
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? true;

    if (!name) {
      return errorResponse({
        message: "Name is required",
        status: 400,
      });
    }

    const supplier = await prisma.supplier.create({
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

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "CREATE",
        module: "suppliers",
        resourceType: "suppliers",
        resourceId: supplier.id,
        oldData: Prisma.JsonNull,
        newData: supplier,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "CREATE",
      module: "suppliers",
      relatedId: supplier.id,
      title: "Supplier Created",
      message: `${auth.user.name || "Someone"} created supplier ${
        supplier.name
      }.`,
    });

    return successResponse({
      message: "Supplier created successfully",
      data: supplier,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/suppliers error:", error);

    return errorResponse({
      message: "Failed to create supplier",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
