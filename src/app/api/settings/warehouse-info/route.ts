import { Prisma } from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

const DEFAULT_WAREHOUSE_INFO_ID = "00000000-0000-0000-0000-000000000001";

const MAX_BANK_ACCOUNTS = 20;

type BankAccountBody = {
  bankName?: string;
  accountNumber?: string;
  logoUrl?: string | null;
};

type UpdateWarehouseInfoBody = {
  storeName?: string;
  ownerName?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  invoiceFooter?: string | null;
  bankAccounts?: BankAccountBody[];
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function GET() {
  try {
    const auth = await requirePermission("warehouse_infos.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const warehouseInfo = await prisma.warehouseInfo.findFirst({
      orderBy: {
        createdAt: "asc",
      },
      include: {
        bankAccounts: {
          orderBy: [
            {
              sortOrder: "asc",
            },
            {
              createdAt: "asc",
            },
          ],
        },
      },
    });

    return successResponse({
      message: "Warehouse info retrieved successfully",
      data: warehouseInfo,
    });
  } catch (error) {
    console.error("GET /api/settings/warehouse-info error:", error);

    return errorResponse({
      message: "Failed to fetch warehouse info",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requirePermission("warehouse_infos.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;
    const body = (await req.json()) as UpdateWarehouseInfoBody;

    const storeName = body.storeName?.trim();

    if (!storeName) {
      return errorResponse({
        message: "Store name wajib diisi",
        status: 400,
      });
    }

    if (body.bankAccounts !== undefined && !Array.isArray(body.bankAccounts)) {
      return errorResponse({
        message: "Data rekening tidak valid",
        status: 400,
      });
    }

    const bankAccountInput = body.bankAccounts ?? [];

    if (bankAccountInput.length > MAX_BANK_ACCOUNTS) {
      return errorResponse({
        message: `Maksimal ${MAX_BANK_ACCOUNTS} rekening`,
        status: 400,
      });
    }

    const bankAccounts = bankAccountInput.map((account, index) => ({
      bankName: account.bankName?.trim() || "",
      accountNumber: account.accountNumber?.trim() || "",
      logoUrl: account.logoUrl?.trim() || null,
      sortOrder: index,
    }));

    const invalidBankAccount = bankAccounts.find(
      (account) => !account.bankName || !account.accountNumber,
    );

    if (invalidBankAccount) {
      return errorResponse({
        message: "Nama bank dan nomor rekening wajib diisi",
        status: 400,
      });
    }

    const duplicateBankAccount = bankAccounts.find((account, index) => {
      return (
        bankAccounts.findIndex((candidate) => {
          return (
            candidate.bankName.toLowerCase() ===
              account.bankName.toLowerCase() &&
            candidate.accountNumber === account.accountNumber
          );
        }) !== index
      );
    });

    if (duplicateBankAccount) {
      return errorResponse({
        message: `Rekening ${duplicateBankAccount.bankName} ${duplicateBankAccount.accountNumber} terduplikasi`,
        status: 400,
      });
    }

    const payload = {
      storeName,
      ownerName: body.ownerName?.trim() || null,
      logoUrl: body.logoUrl?.trim() || null,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      address: body.address?.trim() || null,
      city: body.city?.trim() || null,
      province: body.province?.trim() || null,
      postalCode: body.postalCode?.trim() || null,
      invoiceFooter: body.invoiceFooter?.trim() || null,
    };

    const oldWarehouseInfo = await prisma.warehouseInfo.findFirst({
      orderBy: {
        createdAt: "asc",
      },
      include: {
        bankAccounts: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    const warehouseInfo = await prisma.$transaction(async (tx) => {
      const savedWarehouseInfo = await tx.warehouseInfo.upsert({
        where: {
          id: oldWarehouseInfo?.id || DEFAULT_WAREHOUSE_INFO_ID,
        },
        update: payload,
        create: {
          id: DEFAULT_WAREHOUSE_INFO_ID,
          ...payload,
        },
      });

      await tx.warehouseBankAccount.deleteMany({
        where: {
          warehouseInfoId: savedWarehouseInfo.id,
        },
      });

      if (bankAccounts.length > 0) {
        await tx.warehouseBankAccount.createMany({
          data: bankAccounts.map((account) => ({
            warehouseInfoId: savedWarehouseInfo.id,
            bankName: account.bankName,
            accountNumber: account.accountNumber,
            logoUrl: account.logoUrl,
            sortOrder: account.sortOrder,
          })),
        });
      }

      return tx.warehouseInfo.findUniqueOrThrow({
        where: {
          id: savedWarehouseInfo.id,
        },
        include: {
          bankAccounts: {
            orderBy: [
              {
                sortOrder: "asc",
              },
              {
                createdAt: "asc",
              },
            ],
          },
        },
      });
    });

    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        module: "warehouse_infos",
        resourceType: "warehouse_infos",
        resourceId: warehouseInfo.id,
        oldData: oldWarehouseInfo ? toJson(oldWarehouseInfo) : Prisma.JsonNull,
        newData: toJson(warehouseInfo),
      },
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "warehouse_infos",
      relatedId: warehouseInfo.id,
      title: "Warehouse Info Updated",
      message: `${
        currentUser.name || "User"
      } memperbarui informasi warehouse dan rekening.`,
    });

    return successResponse({
      message: "Warehouse info updated successfully",
      data: warehouseInfo,
    });
  } catch (error) {
    console.error("PATCH /api/settings/warehouse-info error:", error);

    return errorResponse({
      message: "Failed to update warehouse info",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
