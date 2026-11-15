import {
  Prisma,
  PurchasePaymentMethod,
} from "@/../prisma/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications";

import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SavedProofFile = {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileUrl: string;
  absolutePath: string;
};

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
  return path.extname(fileName) || "";
}

function getLocalFilePath(fileUrl: string) {
  const cleanPath = fileUrl.replace(/^\/+/, "");

  return path.join(process.cwd(), "public", cleanPath);
}

async function removeSavedFiles(files: SavedProofFile[]) {
  await Promise.allSettled(
    files.map((file) => {
      return unlink(file.absolutePath);
    }),
  );
}

async function removeLocalFiles(fileUrls: string[]) {
  await Promise.allSettled(
    fileUrls.map((fileUrl) => {
      return unlink(getLocalFilePath(fileUrl));
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

const purchasePaymentInclude = {
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
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      remainingAmount: true,
      paymentStatus: true,
      status: true,
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
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
      createdAt: "asc" as const,
    },
  },
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("purchase_payments.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const payment = await prisma.purchasePayment.findUnique({
      where: {
        id,
      },
      include: purchasePaymentInclude,
    });

    if (!payment) {
      return errorResponse({
        message: "Purchase payment tidak ditemukan",
        status: 404,
      });
    }

    return successResponse({
      message: "Purchase payment retrieved successfully",
      data: {
        ...payment,
        amount: toNumber(payment.amount),
        stockIn: payment.stockIn
          ? {
              ...payment.stockIn,
              totalAmount: toNumber(payment.stockIn.totalAmount),
              paidAmount: toNumber(payment.stockIn.paidAmount),
              remainingAmount: toNumber(payment.stockIn.remainingAmount),
            }
          : null,
      },
    });
  } catch (error) {
    console.error("GET /api/purchase-payments/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch purchase payment",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  let savedFiles: SavedProofFile[] = [];

  try {
    const auth = await requirePermission("purchase_payments.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;
    const { id } = await context.params;

    const formData = await req.formData();

    const stockInId = String(formData.get("stockInId") || "").trim();
    const paymentDate = parseDate(formData.get("paymentDate"));
    const amount = parseAmount(formData.get("amount"));
    const method = String(formData.get("method") || "CASH");
    const referenceNumber =
      String(formData.get("referenceNumber") || "").trim() || null;
    const notes = String(formData.get("notes") || "").trim() || null;

    const removeAttachmentIds = formData
      .getAll("removeAttachmentIds")
      .map((item) => String(item))
      .filter(Boolean);

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
      const oldPayment = await tx.purchasePayment.findUnique({
        where: {
          id,
        },
        include: {
          attachments: true,
          supplier: true,
          stockIn: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
        },
      });

      if (!oldPayment) {
        throw new Error("Purchase payment tidak ditemukan");
      }

      const oldStockIn = await tx.stockIn.findUnique({
        where: {
          id: oldPayment.stockInId,
        },
        include: {
          supplier: true,
        },
      });

      if (!oldStockIn) {
        throw new Error("Stock in lama tidak ditemukan");
      }

      const targetStockIn = await tx.stockIn.findUnique({
        where: {
          id: stockInId,
        },
        include: {
          supplier: true,
        },
      });

      if (!targetStockIn) {
        throw new Error("Stock in tidak ditemukan");
      }

      if (targetStockIn.status === "CANCELLED") {
        throw new Error("Stock in yang sudah cancelled tidak bisa dibayar");
      }

      const oldPaymentAmount = toNumber(oldPayment.amount);

      const oldStockInTotal = toNumber(oldStockIn.totalAmount);
      const oldStockInPaid = toNumber(oldStockIn.paidAmount);

      const revertedOldPaidAmount = Math.max(
        oldStockInPaid - oldPaymentAmount,
        0,
      );
      const revertedOldRemainingAmount = Math.max(
        oldStockInTotal - revertedOldPaidAmount,
        0,
      );
      const revertedOldPaymentStatus = getPaymentStatus(
        oldStockInTotal,
        revertedOldPaidAmount,
      );

      let updatedOldStockIn = null;

      if (oldPayment.stockInId !== targetStockIn.id) {
        updatedOldStockIn = await tx.stockIn.update({
          where: {
            id: oldStockIn.id,
          },
          data: {
            paidAmount: revertedOldPaidAmount,
            remainingAmount: revertedOldRemainingAmount,
            paymentStatus: revertedOldPaymentStatus,
          },
          include: {
            supplier: true,
          },
        });
      }

      const targetTotalAmount = toNumber(targetStockIn.totalAmount);
      const targetPaidAmount =
        oldPayment.stockInId === targetStockIn.id
          ? revertedOldPaidAmount
          : toNumber(targetStockIn.paidAmount);

      const targetRemainingBeforePayment = Math.max(
        targetTotalAmount - targetPaidAmount,
        0,
      );

      if (amount > targetRemainingBeforePayment) {
        throw new Error(
          `Amount pembayaran melebihi sisa utang. Sisa utang: ${targetRemainingBeforePayment}`,
        );
      }

      const newPaidAmount = targetPaidAmount + amount;
      const newRemainingAmount = Math.max(targetTotalAmount - newPaidAmount, 0);
      const newPaymentStatus = getPaymentStatus(
        targetTotalAmount,
        newPaidAmount,
      );

      const updatedPayment = await tx.purchasePayment.update({
        where: {
          id: oldPayment.id,
        },
        data: {
          stockInId: targetStockIn.id,
          supplierId: targetStockIn.supplierId,
          paymentDate,
          amount,
          method,
          referenceNumber,
          notes,
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

      const updatedTargetStockIn = await tx.stockIn.update({
        where: {
          id: targetStockIn.id,
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

      const removableAttachments =
        removeAttachmentIds.length > 0
          ? await tx.purchasePaymentAttachment.findMany({
              where: {
                id: {
                  in: removeAttachmentIds,
                },
                purchasePaymentId: oldPayment.id,
              },
            })
          : [];

      if (removeAttachmentIds.length > 0) {
        await tx.purchasePaymentAttachment.deleteMany({
          where: {
            id: {
              in: removeAttachmentIds,
            },
            purchasePaymentId: oldPayment.id,
          },
        });
      }

      const finalPayment = await tx.purchasePayment.findUnique({
        where: {
          id: oldPayment.id,
        },
        include: purchasePaymentInclude,
      });

      await tx.activityLog.create({
        data: {
          userId: currentUser.id,
          action: "UPDATE",
          module: "purchase_payments",
          resourceType: "purchase_payments",
          resourceId: oldPayment.id,
          oldData: {
            payment: oldPayment,
            stockIn: oldStockIn,
          },
          newData: {
            payment: finalPayment,
            oldStockIn: updatedOldStockIn,
            stockIn: updatedTargetStockIn,
            removedAttachments: removableAttachments,
          },
        },
      });

      return {
        oldPayment,
        payment: finalPayment,
        oldStockIn,
        oldStockInAfterUpdate: updatedOldStockIn,
        stockIn: updatedTargetStockIn,
        removeFileUrls: removableAttachments.map((item) => item.fileUrl),
      };
    });

    if (result.removeFileUrls.length > 0) {
      await removeLocalFiles(result.removeFileUrls);
    }

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "UPDATE",
      module: "purchase_payments",
      relatedId: id,
      title: "Purchase Payment Updated",
      message: `${getActorName(currentUser)} updated purchase payment for ${
        result.stockIn.documentNumber
      }.`,
    });

    return successResponse({
      message: "Purchase payment updated successfully",
      data: {
        payment: result.payment
          ? {
              ...result.payment,
              amount: toNumber(result.payment.amount),
              stockIn: result.payment.stockIn
                ? {
                    ...result.payment.stockIn,
                    totalAmount: toNumber(result.payment.stockIn.totalAmount),
                    paidAmount: toNumber(result.payment.stockIn.paidAmount),
                    remainingAmount: toNumber(
                      result.payment.stockIn.remainingAmount,
                    ),
                  }
                : null,
            }
          : null,
        stockIn: {
          ...result.stockIn,
          totalAmount: toNumber(result.stockIn.totalAmount),
          paidAmount: toNumber(result.stockIn.paidAmount),
          remainingAmount: toNumber(result.stockIn.remainingAmount),
        },
      },
    });
  } catch (error) {
    if (savedFiles.length > 0) {
      await removeSavedFiles(savedFiles);
    }

    console.error("PUT /api/purchase-payments/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to update purchase payment",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("purchase_payments.delete");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const currentUser = auth.user;
    const { id } = await context.params;

    const result = await prisma.$transaction(async (tx) => {
      const oldPayment = await tx.purchasePayment.findUnique({
        where: {
          id,
        },
        include: {
          attachments: true,
          stockIn: true,
          supplier: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
        },
      });

      if (!oldPayment) {
        throw new Error("Purchase payment tidak ditemukan");
      }

      const oldStockIn = await tx.stockIn.findUnique({
        where: {
          id: oldPayment.stockInId,
        },
        include: {
          supplier: true,
        },
      });

      if (!oldStockIn) {
        throw new Error("Stock in tidak ditemukan");
      }

      const paymentAmount = toNumber(oldPayment.amount);
      const totalAmount = toNumber(oldStockIn.totalAmount);
      const oldPaidAmount = toNumber(oldStockIn.paidAmount);

      const newPaidAmount = Math.max(oldPaidAmount - paymentAmount, 0);
      const newRemainingAmount = Math.max(totalAmount - newPaidAmount, 0);
      const newPaymentStatus = getPaymentStatus(totalAmount, newPaidAmount);

      await tx.purchasePayment.delete({
        where: {
          id: oldPayment.id,
        },
      });

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
          action: "DELETE",
          module: "purchase_payments",
          resourceType: "purchase_payments",
          resourceId: oldPayment.id,
          oldData: {
            payment: oldPayment,
            stockIn: oldStockIn,
          },
          newData: {
            stockIn: newStockIn,
          },
        },
      });

      return {
        oldPayment,
        oldStockIn,
        newStockIn,
        fileUrls: oldPayment.attachments.map((item) => item.fileUrl),
      };
    });

    if (result.fileUrls.length > 0) {
      await removeLocalFiles(result.fileUrls);
    }

    await notifyAdmins({
      actorUserId: currentUser.id,
      eventType: "DELETE",
      module: "purchase_payments",
      relatedId: result.oldPayment.id,
      title: "Purchase Payment Deleted",
      message: `${getActorName(currentUser)} deleted purchase payment for ${
        result.newStockIn.documentNumber
      }.`,
    });

    return successResponse({
      message: "Purchase payment deleted successfully",
      data: {
        deletedPayment: {
          ...result.oldPayment,
          amount: toNumber(result.oldPayment.amount),
        },
        stockIn: {
          ...result.newStockIn,
          totalAmount: toNumber(result.newStockIn.totalAmount),
          paidAmount: toNumber(result.newStockIn.paidAmount),
          remainingAmount: toNumber(result.newStockIn.remainingAmount),
        },
      },
    });
  } catch (error) {
    console.error("DELETE /api/purchase-payments/[id] error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete purchase payment",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
