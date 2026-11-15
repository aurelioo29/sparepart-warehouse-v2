-- CreateEnum
CREATE TYPE "KngOrderStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "kng_products" (
    "id" UUID NOT NULL,
    "jenis" VARCHAR(150) NOT NULL,
    "part_number" VARCHAR(200) NOT NULL,
    "harga_jkt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kng_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kng_orders" (
    "id" UUID NOT NULL,
    "order_number" VARCHAR(100) NOT NULL,
    "order_date" DATE NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "total_qty" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "KngOrderStatus" NOT NULL DEFAULT 'POSTED',
    "note_franco" TEXT DEFAULT 'Frangko Medan',
    "note_top" TEXT DEFAULT 'Top = 125 hari',
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "posted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kng_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kng_order_items" (
    "id" UUID NOT NULL,
    "kng_order_id" UUID NOT NULL,
    "kng_product_id" UUID NOT NULL,
    "jenis_snapshot" VARCHAR(150) NOT NULL,
    "part_number_snapshot" VARCHAR(200) NOT NULL,
    "harga_jkt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "harga_netto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kng_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kng_products_jenis_idx" ON "kng_products"("jenis");

-- CreateIndex
CREATE INDEX "kng_products_part_number_idx" ON "kng_products"("part_number");

-- CreateIndex
CREATE INDEX "kng_products_is_active_idx" ON "kng_products"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "kng_products_jenis_part_number_key" ON "kng_products"("jenis", "part_number");

-- CreateIndex
CREATE UNIQUE INDEX "kng_orders_order_number_key" ON "kng_orders"("order_number");

-- CreateIndex
CREATE INDEX "kng_orders_order_number_idx" ON "kng_orders"("order_number");

-- CreateIndex
CREATE INDEX "kng_orders_order_date_idx" ON "kng_orders"("order_date");

-- CreateIndex
CREATE INDEX "kng_orders_status_idx" ON "kng_orders"("status");

-- CreateIndex
CREATE INDEX "kng_orders_created_by_id_idx" ON "kng_orders"("created_by_id");

-- CreateIndex
CREATE INDEX "kng_order_items_kng_order_id_idx" ON "kng_order_items"("kng_order_id");

-- CreateIndex
CREATE INDEX "kng_order_items_kng_product_id_idx" ON "kng_order_items"("kng_product_id");

-- AddForeignKey
ALTER TABLE "kng_orders" ADD CONSTRAINT "kng_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kng_order_items" ADD CONSTRAINT "kng_order_items_kng_order_id_fkey" FOREIGN KEY ("kng_order_id") REFERENCES "kng_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kng_order_items" ADD CONSTRAINT "kng_order_items_kng_product_id_fkey" FOREIGN KEY ("kng_product_id") REFERENCES "kng_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
