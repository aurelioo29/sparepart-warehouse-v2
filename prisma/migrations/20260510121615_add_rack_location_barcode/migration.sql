/*
  Warnings:

  - A unique constraint covering the columns `[barcode_value]` on the table `rack_locations` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "rack_locations" ADD COLUMN     "barcode_value" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "rack_locations_barcode_value_key" ON "rack_locations"("barcode_value");
