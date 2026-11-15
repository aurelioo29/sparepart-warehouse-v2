import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type CreateCustomerBody = {
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

function getCustomerOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.CustomerOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "name":
      return { name: order };

    case "customerType":
      return { customerType: order };

    case "phone":
      return { phone: order };

    case "email":
      return { email: order };

    case "creditLimit":
      return { creditLimit: order };

    case "paymentTermDays":
      return { paymentTermDays: order };

    case "isActive":
      return { isActive: order };

    case "updatedAt":
      return { updatedAt: order };

    case "createdAt":
    default:
      return { createdAt: order };
  }
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

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("customers.view");

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
    const customerType = (searchParams.get("customerType") || "").trim();
    const isActive = (searchParams.get("isActive") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {};

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
          address: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (customerType && isCustomerType(customerType)) {
      where.customerType = customerType;
    }

    if (isActive === "true") {
      where.isActive = true;
    }

    if (isActive === "false") {
      where.isActive = false;
    }

    const [items, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        orderBy: getCustomerOrderBy(sortBy, sortOrder),
        skip,
        take: limit,
      }),

      prisma.customer.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Customers retrieved successfully",
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
    console.error("GET /api/customers error:", error);

    return errorResponse({
      message: "Failed to fetch customers",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("customers.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const body = (await req.json()) as CreateCustomerBody;

    const name = body.name?.trim();
    const customerType = body.customerType?.trim() || "INDIVIDUAL";
    const phone = body.phone?.trim() || null;
    const email = body.email?.trim().toLowerCase() || null;
    const address = body.address?.trim() || null;
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? true;

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

    const customer = await prisma.customer.create({
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

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "CREATE",
        module: "customers",
        resourceType: "customers",
        resourceId: customer.id,
        oldData: Prisma.JsonNull,
        newData: customer,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "CREATE",
      module: "customers",
      relatedId: customer.id,
      title: "Customer Created",
      message: `${auth.user.name || "Someone"} created customer ${
        customer.name
      }.`,
    });

    return successResponse({
      message: "Customer created successfully",
      data: customer,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/customers error:", error);

    return errorResponse({
      message: "Failed to create customer",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
