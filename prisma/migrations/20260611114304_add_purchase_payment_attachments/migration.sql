-- CreateTable
CREATE TABLE "purchase_payment_attachments" (
    "id" UUID NOT NULL,
    "purchase_payment_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_payment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_payment_attachments_purchase_payment_id_idx" ON "purchase_payment_attachments"("purchase_payment_id");

-- AddForeignKey
ALTER TABLE "purchase_payment_attachments" ADD CONSTRAINT "purchase_payment_attachments_purchase_payment_id_fkey" FOREIGN KEY ("purchase_payment_id") REFERENCES "purchase_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
