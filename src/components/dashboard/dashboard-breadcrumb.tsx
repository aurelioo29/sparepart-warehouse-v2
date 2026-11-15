"use client";

import Link from "next/link";
import { Breadcrumb } from "antd";
import { usePathname } from "next/navigation";

const clickablePaths = new Set([
  "/dashboard",

  "/dashboard/categories",
  "/dashboard/brands",
  "/dashboard/units",
  "/dashboard/suppliers",
  "/dashboard/customers",
  "/dashboard/salesmen",

  "/dashboard/warehouses",
  "/dashboard/rack-locations",

  "/dashboard/products",
  "/dashboard/stocks",
  "/dashboard/stock-adjustments",
  "/dashboard/stock-movements",

  "/dashboard/purchases",
  "/dashboard/stock-ins",
  "/dashboard/purchase-payments",
  "/dashboard/payables",

  "/dashboard/kng-products",
  "/dashboard/kng-orders",

  "/dashboard/sales-invoices",
  "/dashboard/sales-payments",
  "/dashboard/receivables",

  "/dashboard/reports/inventory",
  "/dashboard/reports/stock-in",
  "/dashboard/reports/salesman",

  "/dashboard/users",
  "/dashboard/roles",
  "/dashboard/permissions",
  "/dashboard/activity-logs",

  "/dashboard/settings/warehouse-info",
  "/dashboard/settings/general",
]);

function formatSegment(segment: string) {
  const labelMap: Record<string, string> = {
    dashboard: "Dashboard",

    categories: "Categories",
    brands: "Brands",
    units: "Units",
    suppliers: "Suppliers",
    customers: "Customers",
    salesmen: "Salesmen",

    warehouses: "Warehouses",
    "rack-locations": "Rack Locations",

    products: "Products",
    stocks: "Stock Overview",
    "stock-adjustments": "Stock Adjustments",
    "stock-movements": "Stock Movements",

    purchases: "Purchases",
    "stock-ins": "Purchase Invoices",
    "purchase-payments": "Purchase Payments",
    payables: "Payables",

    "kng-products": "Master Products KNG",
    "kng-orders": "Orders KNG",

    "sales-invoices": "Sales Invoices",
    "sales-payments": "Sales Payments",
    receivables: "Receivables",

    reports: "Reports",
    inventory: "Inventory Report",
    "stock-in": "Stock In Report",
    salesman: "Salesman Report",

    users: "Users",
    roles: "Roles",
    permissions: "Permissions",
    "activity-logs": "Activity Logs",

    settings: "Settings",
    "warehouse-info": "Warehouse Info",
    general: "General Settings",

    create: "Create",
    edit: "Edit",
    detail: "Detail",
    changelogs: "Changelogs",
  };

  if (labelMap[segment]) return labelMap[segment];

  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isIdSegment(segment: string) {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment,
    ) || /^[0-9a-f]{20,}$/i.test(segment)
  );
}

export default function DashboardBreadcrumb() {
  const pathname = usePathname();

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "dashboard");

  const breadcrumbItems = segments.map((segment, index) => {
    const href = `/dashboard/${segments.slice(0, index + 1).join("/")}`;
    const isLast = index === segments.length - 1;

    const title = isIdSegment(segment) ? "Detail" : formatSegment(segment);

    const canClick = clickablePaths.has(href) && !isLast;

    return {
      title: canClick ? (
        <Link href={href} className="text-slate-500 hover:text-blue-600">
          {title}
        </Link>
      ) : (
        <span className="font-medium text-slate-700">{title}</span>
      ),
    };
  });

  return (
    <Breadcrumb
      className="!my-4"
      items={[
        {
          title: (
            <Link
              href="/dashboard"
              className="text-slate-500 hover:text-blue-600"
            >
              Home
            </Link>
          ),
        },
        ...breadcrumbItems,
      ]}
    />
  );
}
