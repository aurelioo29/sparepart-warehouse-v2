import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

type CreateSalesmanBody = {
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

function getSalesmanOrderBy(
  sortBy: string,
  sortOrder: string,
): Prisma.SalesmanOrderByWithRelationInput {
  const order: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "code":
      return { code: order };

    case "name":
      return { name: order };

    case "salesmanType":
      return { salesmanType: order };

    case "phone":
      return { phone: order };

    case "email":
      return { email: order };

    case "commissionType":
      return { commissionType: order };

    case "commissionValue":
      return { commissionValue: order };

    case "joinDate":
      return { joinDate: order };

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

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("salesmen.view");

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
    const salesmanType = (searchParams.get("salesmanType") || "").trim();
    const commissionType = (searchParams.get("commissionType") || "").trim();
    const isActive = (searchParams.get("isActive") || "").trim();

    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const skip = (page - 1) * limit;

    const where: Prisma.SalesmanWhereInput = {};

    if (search) {
      where.OR = [
        {
          code: {
            contains: search,
            mode: "insensitive",
          },
        },
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
        {
          user: {
            fullName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    if (salesmanType && isSalesmanType(salesmanType)) {
      where.salesmanType = salesmanType;
    }

    if (commissionType && isCommissionType(commissionType)) {
      where.commissionType = commissionType;
    }

    if (isActive === "true") {
      where.isActive = true;
    }

    if (isActive === "false") {
      where.isActive = false;
    }

    const [items, total] = await prisma.$transaction([
      prisma.salesman.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: getSalesmanOrderBy(sortBy, sortOrder),
        skip,
        take: limit,
      }),

      prisma.salesman.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Salesmen retrieved successfully",
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
    console.error("GET /api/salesmen error:", error);

    return errorResponse({
      message: "Failed to fetch salesmen",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("salesmen.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const body = (await req.json()) as CreateSalesmanBody;

    const userId = body.userId?.trim() || null;
    const code = body.code?.trim().toUpperCase();
    const name = body.name?.trim();
    const salesmanType = body.salesmanType?.trim() || "FREELANCE";
    const phone = body.phone?.trim() || null;
    const email = body.email?.trim().toLowerCase() || null;
    const address = body.address?.trim() || null;
    const commissionType = body.commissionType?.trim() || "NONE";
    const description = body.description?.trim() || null;
    const isActive = body.isActive ?? true;

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

    const existingSalesman = await prisma.salesman.findUnique({
      where: {
        code,
      },
      select: {
        id: true,
      },
    });

    if (existingSalesman) {
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

    const salesman = await prisma.salesman.create({
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
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "CREATE",
        module: "salesmen",
        resourceType: "salesmen",
        resourceId: salesman.id,
        oldData: Prisma.JsonNull,
        newData: salesman,
      },
    });

    await notifyAdmins({
      actorUserId: auth.user.id,
      eventType: "CREATE",
      module: "salesmen",
      relatedId: salesman.id,
      title: "Salesman Created",
      message: `${auth.user.name || "Someone"} created salesman ${salesman.name}.`,
    });

    return successResponse({
      message: "Salesman created successfully",
      data: salesman,
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/salesmen error:", error);

    return errorResponse({
      message:
        error instanceof Error ? error.message : "Failed to create salesman",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
