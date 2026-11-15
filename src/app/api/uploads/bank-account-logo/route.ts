import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("warehouse_infos.update");

    if (!auth.authorized || !auth.user) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return errorResponse({
        message: "File logo wajib dipilih",
        status: 400,
      });
    }

    const extension = ALLOWED_IMAGE_TYPES[file.type];

    if (!extension) {
      return errorResponse({
        message: "Format logo harus JPG, PNG, atau WEBP",
        status: 400,
      });
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return errorResponse({
        message: "Ukuran logo maksimal 2MB",
        status: 400,
      });
    }

    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "bank-account-logos",
    );

    await mkdir(uploadDirectory, {
      recursive: true,
    });

    const fileName = `${randomUUID()}.${extension}`;
    const filePath = path.join(uploadDirectory, fileName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    await writeFile(filePath, fileBuffer);

    return successResponse({
      message: "Logo rekening berhasil diupload",
      data: {
        url: `/uploads/bank-account-logos/${fileName}`,
      },
    });
  } catch (error) {
    console.error("POST /api/uploads/bank-account-logo error:", error);

    return errorResponse({
      message: "Gagal upload logo rekening",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
