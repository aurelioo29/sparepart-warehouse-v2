import { mkdir, stat, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

function getPublicUploadDir() {
  return path.join(process.cwd(), "public", "uploads", "warehouse");
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("warehouse_infos.update");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return errorResponse({
        message: "File logo wajib diupload",
        status: 400,
      });
    }

    if (!allowedMimeTypes.includes(file.type)) {
      return errorResponse({
        message: "Format logo harus JPG, PNG, atau WEBP",
        status: 400,
      });
    }

    const maxSize = 2 * 1024 * 1024;

    if (file.size > maxSize) {
      return errorResponse({
        message: "Ukuran logo maksimal 2MB",
        status: 400,
      });
    }

    const bytes = await file.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);

    if (inputBuffer.length === 0) {
      return errorResponse({
        message: "File logo kosong atau rusak",
        status: 400,
      });
    }

    /**
     * Normalize logo supaya PNG-nya valid dan aman dibaca oleh:
     * - browser
     * - next/image kalau masih ada
     * - @react-pdf/renderer
     *
     * Kita resize juga supaya logo tidak kegedean untuk PDF.
     */
    let normalizedBuffer: Buffer;

    try {
      normalizedBuffer = await sharp(inputBuffer, {
        failOn: "error",
      })
        .rotate()
        .resize({
          width: 512,
          height: 512,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          force: true,
        })
        .toBuffer();
    } catch (error) {
      console.error("Logo normalization error:", error);

      return errorResponse({
        message:
          "Logo tidak valid atau file gambar rusak. Coba upload ulang dengan PNG/JPG yang bersih.",
        status: 400,
        errors: error instanceof Error ? error.message : error,
      });
    }

    const uploadDir = getPublicUploadDir();

    await mkdir(uploadDir, {
      recursive: true,
    });

    const filename = `warehouse-logo-${Date.now()}-${crypto.randomUUID()}.png`;
    const filepath = path.join(uploadDir, filename);

    await writeFile(filepath, normalizedBuffer);

    const uploadedFileStat = await stat(filepath);

    if (!uploadedFileStat.isFile() || uploadedFileStat.size <= 0) {
      return errorResponse({
        message: "Logo gagal disimpan ke server",
        status: 500,
      });
    }

    const url = `/uploads/warehouse/${filename}`;

    console.log("Warehouse logo uploaded:", {
      cwd: process.cwd(),
      uploadDir,
      filepath,
      url,
      originalSize: inputBuffer.length,
      normalizedSize: uploadedFileStat.size,
      originalMimeType: file.type,
      savedMimeType: "image/png",
    });

    return successResponse({
      message: "Logo uploaded successfully",
      data: {
        url,
        filename,
        size: uploadedFileStat.size,
        mimeType: "image/png",
      },
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/uploads/warehouse-logo error:", error);

    return errorResponse({
      message: "Failed to upload warehouse logo",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
