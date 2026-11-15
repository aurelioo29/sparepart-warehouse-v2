-- CreateTable
CREATE TABLE "warehouse_bank_accounts" (
    "id" UUID NOT NULL,
    "warehouse_info_id" UUID NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "account_number" VARCHAR(100) NOT NULL,
    "logo_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warehouse_bank_accounts_warehouse_info_id_idx" ON "warehouse_bank_accounts"("warehouse_info_id");

-- AddForeignKey
ALTER TABLE "warehouse_bank_accounts" ADD CONSTRAINT "warehouse_bank_accounts_warehouse_info_id_fkey" FOREIGN KEY ("warehouse_info_id") REFERENCES "warehouse_infos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
