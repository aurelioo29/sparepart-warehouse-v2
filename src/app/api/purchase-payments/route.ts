import {
  Prisma,
  PurchasePaymentMethod,
} from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "purchase-payments",
);

const PUBLIC_UPLOAD_PATH = "/uploads/purchase-payments";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 10;

const allowedMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

type SavedProofFile = {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileUrl: string;
  absolutePath: string;
};

const purchasePaymentMethods: PurchasePaymentMethod[] = [
  "CASH",
  "TRANSFER",
  "DEBIT",
  "CREDIT",
  "QRIS",
  "OTHER",
];

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value || 0);
}

function parseDate(value: unknown) {
  if (!value) return new Date();

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal pembayaran tidak valid");
  }

  return date;
}

function parseAmount(value: unknown) {
  const amount = Number(value || 0);

  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error("Amount pembayaran harus lebih dari 0");
  }

  return amount;
}

function getPaymentStatus(totalAmount: number, paidAmount: number) {
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);

  if (remainingAmount <= 0) return "PAID";
  if (paidAmount > 0) return "PARTIAL";

  return "UNPAID";
}

function isPurchasePaymentMethod(
  value: string,
): value is PurchasePaymentMethod {
  return purchasePaymentMethods.includes(value as PurchasePaymentMethod);
}

function getActorName(user: {
  name?: string | null;
  username?: string | null;
}) {
  return user.name || user.username || "Someone";
}

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

function getFileExtension(fileName: string) {
  const extension = path.extname(fileName);

  return extension || "";
}

async function removeSavedFiles(files: SavedProofFile[]) {
  await Promise.allSettled(
    files.map((file) => {
      return unlink(file.absolutePath);
    }),
  );
}

async function saveProofFiles(files: File[]) {
  if (files.length > MAX_FILES) {
    throw new Error(`Maksimal upload ${MAX_FILES} file bukti pembayaran`);
  }

  await mkdir(UPLOAD_DIR, {
    recursive: true,
  });

  const savedFiles: SavedProofFile[] = [];

  for (const file of files) {
    if (!allowedMimeTypes.includes(file.type)) {
      throw new Error(
        `File "${file.name}" tidak valid. Hanya support gambar dan PDF.`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `File "${file.name}" terlalu besar. Maksimal 5MB per file.`,
      );
    }

    const originalName = file.name || "proof-file";
    const safeOriginalName = sanitizeFileName(originalName);
    const extension = getFileExtension(safeOriginalName);

    const fileName = `${randomUUID()}${extension}`;
    const absolutePath = path.join(UPLOAD_DIR, fileName);
    const fileUrl = `${PUBLIC_UPLOAD_PATH}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await writeFile(absolutePath, buffer);

    savedFiles.push({
      fileName,
      originalName,
      mimeType: file.type,
      size: file.size,
      fileUrl,
      absolutePath,
    });
  }

  return savedFiles;
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("purchase_payments.view");

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
    const supplierId = (searchParams.get("supplierId") || "").trim();
    const method = (searchParams.get("method") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = Number.isNaN(limit) || limit < 1 ? 10 : limit;
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.PurchasePaymentWhereInput = {};

    if (search) {
      where.OR = [
        {
          referenceNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          notes: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          stockIn: {
            documentNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          stockIn: {
            invoiceNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          supplier: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (method) {
      if (!isPurchasePaymentMethod(method)) {
        return errorResponse({
          message: "Metode pembayaran tidak valid",
          status: 400,
        });
      }

      where.method = method;
    }

    if (dateFrom || dateTo) {
      where.paymentDate = {};

      if (dateFrom) {
        where.paymentDate.gte = new Date(dateFrom);
      }

      if (dateTo) {
        where.paymentDate.lte = new Date(dateTo);
      }
    }

    const [items, total] = await prisma.$transaction([
      prisma.purchasePayment.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          stockIn: {
            select: {
              id: true,
              documentNumber: true,
              invoiceNumber: true,
              stockInDate: true,
              totalAmount: true,
              paidAmount: true,
              remainingAmount: true,
              paymentStatus: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
              originalName: true,
              mimeType: true,
              size: true,
              fileUrl: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          _count: {
            select: {
              attachments: true,
            },
          },
        },
        orderBy: {
          paymentDate: "desc",
        },
        skip,
        take: safeLimit,
      }),

      prisma.purchasePayment.count({
        where,
      }),
    ]);

    return successResponse({
      message: "Purchase payments retrieved successfully",
      data: {
        items: items.map((item) => ({
          ...item,
          amount: toNumber(item.amount),
          stockIn: item.stockIn
            ? {
                ...item.stockIn,
                totalAmount: toNumber(item.stockIn.totalAmount),
                paidAmount: toNumber(item.stockIn.paidAmount),
                remainingAmount: toNumber(item.stockIn.remainingAmount),
              }
            : null,
        })),
        meta: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/purchase-payments error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch purchase payments",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function POST(req: Request) {
  let savedFiles: SavedProofFile[] = [];

  try {
    const auth = await requirePermission("purchase_payments.create");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;
    const formData = await req.formData();

    const stockInId = String(formData.get("stockInId") || "").trim();
    const paymentDate = parseDate(formData.get("paymentDate"));
    const amount = parseAmount(formData.get("amount"));
    const method = String(formData.get("method") || "CASH");
    const referenceNumber =
      String(formData.get("referenceNumber") || "").trim() || null;
    const notes = String(formData.get("notes") || "").trim() || null;

    const proofFiles = formData
      .getAll("proofFiles")
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (!stockInId) {
      return errorResponse({
        message: "Stock in wajib dipilih",
        status: 400,
      });
    }

    if (!isPurchasePaymentMethod(method)) {
      return errorResponse({
        message: "Metode pembayaran tidak valid",
        status: 400,
      });
    }

    savedFiles = await saveProofFiles(proofFiles);

    const result = await prisma.$transaction(async (tx) => {
      const oldStockIn = await tx.stockIn.findUnique({
        where: {
          id: stockInId,
        },
        include: {
          supplier: true,
        },
      });

      if (!oldStockIn) {
        throw new Error("Stock in tidak ditemukan");
      }

      if (oldStockIn.status === "CANCELLED") {
        throw new Error("Stock in yang sudah cancelled tidak bisa dibayar");
      }

      const totalAmount = toNumber(oldStockIn.totalAmount);
      const oldPaidAmount = toNumber(oldStockIn.paidAmount);
      const oldRemainingAmount = toNumber(oldStockIn.remainingAmount);

      if (oldRemainingAmount <= 0) {
        throw new Error("Invoice pembelian ini sudah lunas");
      }

      if (amount > oldRemainingAmount) {
        throw new Error(
          `Amount pembayaran melebihi sisa utang. Sisa utang: ${oldRemainingAmount}`,
        );
      }

      const payment = await tx.purchasePayment.create({
        data: {
          stockInId: oldStockIn.id,
          supplierId: oldStockIn.supplierId,
          paymentDate,
          amount,
          method,
          referenceNumber,
          notes,
          createdById: currentUser.id,
          attachments:
            savedFiles.length > 0
              ? {
                  create: savedFiles.map((file) => ({
                    fileName: file.fileName,
                    originalName: file.originalName,
                    mimeType: file.mimeType,
                    size: file.size,
                    fileUrl: file.fileUrl,
                  })),
                }
              : undefined,
        },
        include: {
          supplier: true,
          stockIn: true,
          attachments: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
        },
      });

      const newPaidAmount = oldPaidAmount + amount;
      const newRemainingAmount = Math.max(totalAmount - newPaidAmount, 0);
      const newPaymentStatus = getPaymentStatus(totalAmount, newPaidAmount);

      const newStockIn = await tx.stockIn.update({
        where: {
          id: oldStockIn.id,
        },
        data: {
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          paymentStatus: newPaymentStatus,
        },
        include: {
          supplier: true,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "CREATE",
          module: "purchase_payments",
          resourceType: "purchase_payments",
          resourceId: payment.id,
          oldData: oldStockIn,
          newData: {
            payment,
            stockIn: newStockIn,
          },
        },
      });

      return {
        payment,
        oldStockIn,
        newStockIn,
      };
    });

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "CREATE",
      module: "purchase_payments",
      relatedId: result.payment.id,
      title: "Purchase Payment Created",
      message: `${getActorName(currentUser)} recorded purchase payment for ${
        result.newStockIn.documentNumber
      }.`,
    });

    return successResponse({
      message: "Purchase payment created successfully",
      data: {
        payment: {
          ...result.payment,
          amount: toNumber(result.payment.amount),
        },
        stockIn: {
          ...result.newStockIn,
          totalAmount: toNumber(result.newStockIn.totalAmount),
          paidAmount: toNumber(result.newStockIn.paidAmount),
          remainingAmount: toNumber(result.newStockIn.remainingAmount),
        },
      },
      status: 201,
    });
  } catch (error) {
    if (savedFiles.length > 0) {
      await removeSavedFiles(savedFiles);
    }

    console.error("POST /api/purchase-payments error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to create purchase payment",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
