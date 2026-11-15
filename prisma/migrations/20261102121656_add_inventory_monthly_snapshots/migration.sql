-- CreateTable
CREATE TABLE "inventory_monthly_snapshots" (
    "id" UUID NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "cutoff_at" TIMESTAMP(3) NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_monthly_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_monthly_snapshot_items" (
    "id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "category_id" UUID,
    "brand_id" UUID,
    "warehouse_id" UUID,
    "closing_stock" INTEGER NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "inventory_monthly_snapshot_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_monthly_snapshots_period_key" ON "inventory_monthly_snapshots"("period");

-- CreateIndex
CREATE INDEX "inventory_monthly_snapshot_items_snapshot_id_category_id_idx" ON "inventory_monthly_snapshot_items"("snapshot_id", "category_id");

-- CreateIndex
CREATE INDEX "inventory_monthly_snapshot_items_snapshot_id_brand_id_idx" ON "inventory_monthly_snapshot_items"("snapshot_id", "brand_id");

-- CreateIndex
CREATE INDEX "inventory_monthly_snapshot_items_snapshot_id_warehouse_id_idx" ON "inventory_monthly_snapshot_items"("snapshot_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_monthly_snapshot_items_snapshot_id_product_id_key" ON "inventory_monthly_snapshot_items"("snapshot_id", "product_id");

-- AddForeignKey
ALTER TABLE "inventory_monthly_snapshot_items" ADD CONSTRAINT "inventory_monthly_snapshot_items_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "inventory_monthly_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
