-- CreateEnum
CREATE TYPE "StockAdjustmentStatus" AS ENUM ('POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockAdjustmentReason" AS ENUM ('STOCK_OPNAME', 'DAMAGED', 'LOST', 'FOUND', 'INPUT_ERROR', 'OTHER');

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "adjustment_date" DATE NOT NULL,
    "reason" "StockAdjustmentReason" NOT NULL DEFAULT 'OTHER',
    "status" "StockAdjustmentStatus" NOT NULL DEFAULT 'POSTED',
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "posted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_items" (
    "id" UUID NOT NULL,
    "stock_adjustment_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID,
    "rack_location_id" UUID,
    "stock_before" INTEGER NOT NULL,
    "stock_after" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_adjustment_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_document_number_key" ON "stock_adjustments"("document_number");

-- CreateIndex
CREATE INDEX "stock_adjustments_document_number_idx" ON "stock_adjustments"("document_number");

-- CreateIndex
CREATE INDEX "stock_adjustments_adjustment_date_idx" ON "stock_adjustments"("adjustment_date");

-- CreateIndex
CREATE INDEX "stock_adjustments_reason_idx" ON "stock_adjustments"("reason");

-- CreateIndex
CREATE INDEX "stock_adjustments_status_idx" ON "stock_adjustments"("status");

-- CreateIndex
CREATE INDEX "stock_adjustments_created_by_id_idx" ON "stock_adjustments"("created_by_id");

-- CreateIndex
CREATE INDEX "stock_adjustment_items_stock_adjustment_id_idx" ON "stock_adjustment_items"("stock_adjustment_id");

-- CreateIndex
CREATE INDEX "stock_adjustment_items_product_id_idx" ON "stock_adjustment_items"("product_id");

-- CreateIndex
CREATE INDEX "stock_adjustment_items_warehouse_id_idx" ON "stock_adjustment_items"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_adjustment_items_rack_location_id_idx" ON "stock_adjustment_items"("rack_location_id");

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_stock_adjustment_id_fkey" FOREIGN KEY ("stock_adjustment_id") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_rack_location_id_fkey" FOREIGN KEY ("rack_location_id") REFERENCES "rack_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
