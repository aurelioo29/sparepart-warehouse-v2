export type InventoryStockStatus = "NORMAL" | "LOW_STOCK" | "OUT_OF_STOCK";

export type InventoryRow = {
  id: string;
  sku: string;
  barcode: string;
  productName: string;

  category: string;
  brand: string;
  unit: string;
  supplier: string;
  warehouse: string;
  rackLocation: string;

  currentStock: number;
  minStock: number;

  purchasePrice: number;
  sellingPrice: number;
  purchaseStockValue: number;
  sellingStockValue: number;

  stockStatus: InventoryStockStatus;
};

export type InventoryFilters = {
  search: string;
  categoryId: string;
  brandId: string;
  warehouseId: string;
};

export type InventorySummary = {
  totalItems: number;
  totalStock: number;
  totalPurchaseValue: number;
  totalSellingValue: number;
  lowStockItems: number;
  outOfStockItems: number;
};

export type InventoryPeriod = {
  year: number;
  month: number;
  mode: "snapshot";
  dateFrom: string;
  dateTo: string;
  capturedAt: string;
};

export type InventoryReportData = {
  summary: InventorySummary;
  items: InventoryRow[];
  period?: InventoryPeriod;
};
