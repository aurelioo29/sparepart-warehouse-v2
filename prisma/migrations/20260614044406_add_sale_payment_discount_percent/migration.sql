-- AlterTable
ALTER TABLE "sale_payments" ADD COLUMN     "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "sale_payments_discount_percent_idx" ON "sale_payments"("discount_percent");
