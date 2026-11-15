-- CreateEnum
CREATE TYPE "PurchasePaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "PurchasePaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'DEBIT', 'CREDIT', 'QRIS', 'OTHER');

-- AlterTable
ALTER TABLE "stock_ins" ADD COLUMN     "due_date" DATE,
ADD COLUMN     "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payment_status" "PurchasePaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "remaining_amount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "purchase_payments" (
    "id" UUID NOT NULL,
    "stock_in_id" UUID NOT NULL,
    "supplier_id" UUID,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PurchasePaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference_number" VARCHAR(100),
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_payments_stock_in_id_idx" ON "purchase_payments"("stock_in_id");

-- CreateIndex
CREATE INDEX "purchase_payments_supplier_id_idx" ON "purchase_payments"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_payments_payment_date_idx" ON "purchase_payments"("payment_date");

-- CreateIndex
CREATE INDEX "purchase_payments_method_idx" ON "purchase_payments"("method");

-- CreateIndex
CREATE INDEX "purchase_payments_created_by_id_idx" ON "purchase_payments"("created_by_id");

-- CreateIndex
CREATE INDEX "stock_ins_invoice_number_idx" ON "stock_ins"("invoice_number");

-- CreateIndex
CREATE INDEX "stock_ins_payment_status_idx" ON "stock_ins"("payment_status");

-- CreateIndex
CREATE INDEX "stock_ins_due_date_idx" ON "stock_ins"("due_date");

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_stock_in_id_fkey" FOREIGN KEY ("stock_in_id") REFERENCES "stock_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
