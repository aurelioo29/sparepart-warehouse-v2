-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockReferenceType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'SALE', 'SALE_RETURN', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockInStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockOutStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockOutReason" AS ENUM ('INTERNAL_USE', 'DAMAGED', 'LOST', 'RETURN_TO_SUPPLIER', 'OTHER');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalePaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "SalePaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'DEBIT', 'CREDIT', 'QRIS', 'OTHER');

-- CreateTable
CREATE TABLE "stock_ins" (
    "id" UUID NOT NULL,
    "supplier_id" UUID,
    "document_number" VARCHAR(100) NOT NULL,
    "stock_in_date" DATE NOT NULL,
    "status" "StockInStatus" NOT NULL DEFAULT 'POSTED',
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "posted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_in_items" (
    "id" UUID NOT NULL,
    "stock_in_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID,
    "rack_location_id" UUID,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_in_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_outs" (
    "id" UUID NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "stock_out_date" DATE NOT NULL,
    "reason" "StockOutReason" NOT NULL DEFAULT 'OTHER',
    "status" "StockOutStatus" NOT NULL DEFAULT 'POSTED',
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "posted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_outs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_out_items" (
    "id" UUID NOT NULL,
    "stock_out_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID,
    "rack_location_id" UUID,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_out_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "salesman_id" UUID,
    "invoice_number" VARCHAR(100) NOT NULL,
    "sale_date" DATE NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'POSTED',
    "payment_status" "SalePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remaining_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "due_date" DATE,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "posted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID,
    "rack_location_id" UUID,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_payments" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "SalePaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference_number" VARCHAR(100),
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID,
    "rack_location_id" UUID,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stock_before" INTEGER NOT NULL,
    "stock_after" INTEGER NOT NULL,
    "reference_type" "StockReferenceType" NOT NULL,
    "reference_id" UUID,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_ins_document_number_key" ON "stock_ins"("document_number");

-- CreateIndex
CREATE INDEX "stock_ins_supplier_id_idx" ON "stock_ins"("supplier_id");

-- CreateIndex
CREATE INDEX "stock_ins_document_number_idx" ON "stock_ins"("document_number");

-- CreateIndex
CREATE INDEX "stock_ins_stock_in_date_idx" ON "stock_ins"("stock_in_date");

-- CreateIndex
CREATE INDEX "stock_ins_status_idx" ON "stock_ins"("status");

-- CreateIndex
CREATE INDEX "stock_ins_created_by_id_idx" ON "stock_ins"("created_by_id");

-- CreateIndex
CREATE INDEX "stock_in_items_stock_in_id_idx" ON "stock_in_items"("stock_in_id");

-- CreateIndex
CREATE INDEX "stock_in_items_product_id_idx" ON "stock_in_items"("product_id");

-- CreateIndex
CREATE INDEX "stock_in_items_warehouse_id_idx" ON "stock_in_items"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_in_items_rack_location_id_idx" ON "stock_in_items"("rack_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_outs_document_number_key" ON "stock_outs"("document_number");

-- CreateIndex
CREATE INDEX "stock_outs_document_number_idx" ON "stock_outs"("document_number");

-- CreateIndex
CREATE INDEX "stock_outs_stock_out_date_idx" ON "stock_outs"("stock_out_date");

-- CreateIndex
CREATE INDEX "stock_outs_reason_idx" ON "stock_outs"("reason");

-- CreateIndex
CREATE INDEX "stock_outs_status_idx" ON "stock_outs"("status");

-- CreateIndex
CREATE INDEX "stock_outs_created_by_id_idx" ON "stock_outs"("created_by_id");

-- CreateIndex
CREATE INDEX "stock_out_items_stock_out_id_idx" ON "stock_out_items"("stock_out_id");

-- CreateIndex
CREATE INDEX "stock_out_items_product_id_idx" ON "stock_out_items"("product_id");

-- CreateIndex
CREATE INDEX "stock_out_items_warehouse_id_idx" ON "stock_out_items"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_out_items_rack_location_id_idx" ON "stock_out_items"("rack_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_number_key" ON "sales"("invoice_number");

-- CreateIndex
CREATE INDEX "sales_customer_id_idx" ON "sales"("customer_id");

-- CreateIndex
CREATE INDEX "sales_salesman_id_idx" ON "sales"("salesman_id");

-- CreateIndex
CREATE INDEX "sales_invoice_number_idx" ON "sales"("invoice_number");

-- CreateIndex
CREATE INDEX "sales_sale_date_idx" ON "sales"("sale_date");

-- CreateIndex
CREATE INDEX "sales_status_idx" ON "sales"("status");

-- CreateIndex
CREATE INDEX "sales_payment_status_idx" ON "sales"("payment_status");

-- CreateIndex
CREATE INDEX "sales_due_date_idx" ON "sales"("due_date");

-- CreateIndex
CREATE INDEX "sales_created_by_id_idx" ON "sales"("created_by_id");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sale_items_product_id_idx" ON "sale_items"("product_id");

-- CreateIndex
CREATE INDEX "sale_items_warehouse_id_idx" ON "sale_items"("warehouse_id");

-- CreateIndex
CREATE INDEX "sale_items_rack_location_id_idx" ON "sale_items"("rack_location_id");

-- CreateIndex
CREATE INDEX "sale_payments_sale_id_idx" ON "sale_payments"("sale_id");

-- CreateIndex
CREATE INDEX "sale_payments_payment_date_idx" ON "sale_payments"("payment_date");

-- CreateIndex
CREATE INDEX "sale_payments_method_idx" ON "sale_payments"("method");

-- CreateIndex
CREATE INDEX "sale_payments_created_by_id_idx" ON "sale_payments"("created_by_id");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_idx" ON "stock_movements"("product_id");

-- CreateIndex
CREATE INDEX "stock_movements_warehouse_id_idx" ON "stock_movements"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_movements_rack_location_id_idx" ON "stock_movements"("rack_location_id");

-- CreateIndex
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type");

-- CreateIndex
CREATE INDEX "stock_movements_reference_type_idx" ON "stock_movements"("reference_type");

-- CreateIndex
CREATE INDEX "stock_movements_reference_id_idx" ON "stock_movements"("reference_id");

-- CreateIndex
CREATE INDEX "stock_movements_created_by_id_idx" ON "stock_movements"("created_by_id");

-- CreateIndex
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements"("created_at");

-- AddForeignKey
ALTER TABLE "stock_ins" ADD CONSTRAINT "stock_ins_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ins" ADD CONSTRAINT "stock_ins_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_in_items" ADD CONSTRAINT "stock_in_items_stock_in_id_fkey" FOREIGN KEY ("stock_in_id") REFERENCES "stock_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_in_items" ADD CONSTRAINT "stock_in_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_in_items" ADD CONSTRAINT "stock_in_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_in_items" ADD CONSTRAINT "stock_in_items_rack_location_id_fkey" FOREIGN KEY ("rack_location_id") REFERENCES "rack_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_outs" ADD CONSTRAINT "stock_outs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_out_items" ADD CONSTRAINT "stock_out_items_stock_out_id_fkey" FOREIGN KEY ("stock_out_id") REFERENCES "stock_outs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_out_items" ADD CONSTRAINT "stock_out_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_out_items" ADD CONSTRAINT "stock_out_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_out_items" ADD CONSTRAINT "stock_out_items_rack_location_id_fkey" FOREIGN KEY ("rack_location_id") REFERENCES "rack_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_salesman_id_fkey" FOREIGN KEY ("salesman_id") REFERENCES "salesmen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_rack_location_id_fkey" FOREIGN KEY ("rack_location_id") REFERENCES "rack_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_rack_location_id_fkey" FOREIGN KEY ("rack_location_id") REFERENCES "rack_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
