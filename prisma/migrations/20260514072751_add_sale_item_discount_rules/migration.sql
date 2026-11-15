-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "additional_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_qty" INTEGER NOT NULL DEFAULT 0;
