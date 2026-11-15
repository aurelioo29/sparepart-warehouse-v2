import type { MenuProps } from "antd";
import type { ReactNode } from "react";

import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  CodeSandboxOutlined,
  ContactsOutlined,
  DatabaseOutlined,
  DollarOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FundOutlined,
  HomeOutlined,
  IdcardOutlined,
  InboxOutlined,
  KeyOutlined,
  LineChartOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  SwapOutlined,
  TagsOutlined,
  TeamOutlined,
  ToolOutlined,
  TrademarkOutlined,
  TruckOutlined,
  UnorderedListOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";

export type DashboardMenuItem = {
  key: string;
  icon?: ReactNode;
  label: ReactNode;
  permission?: string;
  children?: DashboardMenuItem[];
};

export const dashboardMenuItems: DashboardMenuItem[] = [
  {
    key: "/dashboard",
    icon: <HomeOutlined />,
    label: "Dashboard",
    permission: "dashboard.view",
  },

  // ============================================================
  // MASTER DATA
  // ============================================================

  {
    key: "master-data",
    icon: <DatabaseOutlined />,
    label: "Master Data",
    children: [
      {
        key: "/dashboard/categories",
        icon: <TagsOutlined />,
        label: "Categories",
        permission: "categories.view",
      },
      {
        key: "/dashboard/brands",
        icon: <TrademarkOutlined />,
        label: "Brands",
        permission: "brands.view",
      },
      {
        key: "/dashboard/units",
        icon: <ApartmentOutlined />,
        label: "Units",
        permission: "units.view",
      },
      {
        key: "/dashboard/suppliers",
        icon: <TruckOutlined />,
        label: "Suppliers",
        permission: "suppliers.view",
      },
      {
        key: "/dashboard/customers",
        icon: <ContactsOutlined />,
        label: "Customers",
        permission: "customers.view",
      },
      {
        key: "/dashboard/salesmen",
        icon: <IdcardOutlined />,
        label: "Salesmen",
        permission: "salesmen.view",
      },
    ],
  },

  // ============================================================
  // WAREHOUSE
  // ============================================================

  {
    key: "warehouse",
    icon: <InboxOutlined />,
    label: "Warehouse",
    children: [
      {
        key: "/dashboard/warehouses",
        icon: <BankOutlined />,
        label: "Warehouses",
        permission: "warehouses.view",
      },
      {
        key: "/dashboard/rack-locations",
        icon: <ApartmentOutlined />,
        label: "Rack Locations",
        permission: "rack_locations.view",
      },
    ],
  },

  // ============================================================
  // INVENTORY
  // ============================================================

  {
    key: "inventory",
    icon: <AppstoreOutlined />,
    label: "Inventory",
    children: [
      {
        key: "/dashboard/products",
        icon: <CodeSandboxOutlined />,
        label: "Products",
        permission: "products.view",
      },
      {
        key: "/dashboard/stocks",
        icon: <FundOutlined />,
        label: "Stock Overview",
        permission: "stocks.view",
      },
      {
        key: "/dashboard/stock-adjustments",
        icon: <ToolOutlined />,
        label: "Adjustments",
        permission: "stock_adjustments.view",
      },
      {
        key: "/dashboard/stock-movements",
        icon: <SwapOutlined />,
        label: "Stock Movements",
        permission: "stock_movements.view",
      },
    ],
  },

  // ============================================================
  // PURCHASE
  // ============================================================

  {
    key: "purchase",
    icon: <ShoppingOutlined />,
    label: "Purchase",
    children: [
      {
        key: "/dashboard/purchases",
        icon: <ProfileOutlined />,
        label: "Purchase Overview",

        /**
         * Untuk sementara Purchase Overview menggunakan
         * permission stock_ins.view.
         *
         * Jika Purchase menjadi module terpisah,
         * sebaiknya buat permission purchases.view.
         */
        permission: "stock_ins.view",
      },
      {
        key: "/dashboard/stock-ins",
        icon: <FileDoneOutlined />,
        label: "Purchase Invoices",
        permission: "stock_ins.view",
      },
      {
        key: "/dashboard/purchase-payments",
        icon: <DollarOutlined />,
        label: "Purchase Payments",
        permission: "purchase_payments.view",
      },
      {
        key: "/dashboard/payables",
        icon: <WalletOutlined />,
        label: "Payables",
        permission: "payables.view",
      },
    ],
  },

  // ============================================================
  // KNG
  // ============================================================

  {
    key: "kng",
    icon: <FileTextOutlined />,
    label: "KNG",
    children: [
      {
        key: "/dashboard/kng-products",
        icon: <ShopOutlined />,
        label: "Master Products",
        permission: "kng-products.view",
      },
      {
        key: "/dashboard/kng-orders",
        icon: <UnorderedListOutlined />,
        label: "Orders",
        permission: "kng-orders.view",
      },
    ],
  },

  // ============================================================
  // SALES
  // ============================================================

  {
    key: "sales",
    icon: <ShoppingCartOutlined />,
    label: "Sales",
    children: [
      {
        key: "/dashboard/sales-invoices",
        icon: <FileTextOutlined />,
        label: "Sales Invoices",
        permission: "sales.view",
      },
      {
        key: "/dashboard/sales-payments",
        icon: <DollarOutlined />,
        label: "Payments",
        permission: "sale_payments.view",
      },
      {
        key: "/dashboard/receivables",
        icon: <WalletOutlined />,
        label: "Receivables",
        permission: "receivables.view",
      },
    ],
  },

  // ============================================================
  // REPORTS
  // ============================================================

  {
    key: "reports",
    icon: <BarChartOutlined />,
    label: "Reports",
    children: [
      {
        key: "/dashboard/reports/inventory",
        icon: <BarChartOutlined />,
        label: "Inventory Report",
        permission: "reports.inventory.view",
      },
      {
        key: "/dashboard/reports/stock-in",
        icon: <LineChartOutlined />,
        label: "Stock In Report",
        permission: "reports.stock_in.view",
      },
      {
        key: "/dashboard/reports/salesman",
        icon: <FileSearchOutlined />,
        label: "Salesman Report",
        permission: "reports.salesman.view",
      },
    ],
  },

  // ============================================================
  // ADMINISTRATION
  // ============================================================

  {
    key: "administration",
    icon: <TeamOutlined />,
    label: "Administration",
    children: [
      {
        key: "/dashboard/users",
        icon: <UserOutlined />,
        label: "Users",
        permission: "users.view",
      },
      {
        key: "/dashboard/roles",
        icon: <SafetyCertificateOutlined />,
        label: "Roles",
        permission: "roles.view",
      },
      {
        key: "/dashboard/permissions",
        icon: <KeyOutlined />,
        label: "Permissions",
        permission: "permissions.view",
      },
      {
        key: "/dashboard/activity-logs",
        icon: <AuditOutlined />,
        label: "Activity Logs",
        permission: "activity_logs.view",
      },
    ],
  },

  // ============================================================
  // SETTINGS
  // ============================================================

  {
    key: "settings",
    icon: <SettingOutlined />,
    label: "Settings",
    children: [
      {
        key: "/dashboard/settings/warehouse-info",
        icon: <BankOutlined />,
        label: "Warehouse Info",
        permission: "warehouse_infos.view",
      },
      {
        key: "/dashboard/settings/general",
        icon: <SettingOutlined />,
        label: "General Settings",
        permission: "settings.view",
      },
    ],
  },
];

// ============================================================
// FILTER MENU BY PERMISSION
// ============================================================

export function filterDashboardMenuItems(
  items: DashboardMenuItem[],
  permissions: string[],
): DashboardMenuItem[] {
  const permissionSet = new Set(permissions);

  return items.reduce<DashboardMenuItem[]>((result, item) => {
    /**
     * Kalau menu mempunyai children,
     * filter children terlebih dahulu.
     */
    if (item.children?.length) {
      const filteredChildren = filterDashboardMenuItems(
        item.children,
        permissions,
      );

      /**
       * Kalau semua children tidak memiliki akses,
       * parent menu juga tidak ditampilkan.
       */
      if (filteredChildren.length === 0) {
        return result;
      }

      result.push({
        ...item,
        children: filteredChildren,
      });

      return result;
    }

    /**
     * Menu tanpa permission dianggap dapat diakses
     * oleh semua user dashboard.
     */
    if (!item.permission) {
      result.push(item);
      return result;
    }

    /**
     * Tampilkan menu jika user mempunyai permission.
     */
    if (permissionSet.has(item.permission)) {
      result.push(item);
    }

    return result;
  }, []);
}

// ============================================================
// GET MENU FOR USER
// ============================================================

export function getDashboardMenuItems(
  permissions: string[],
): MenuProps["items"] {
  return filterDashboardMenuItems(
    dashboardMenuItems,
    permissions,
  ) as MenuProps["items"];
}

// ============================================================
// GET ALL ROUTE PATHS
// ============================================================

function collectMenuPaths(items: DashboardMenuItem[]): string[] {
  const paths: string[] = [];

  for (const item of items) {
    if (item.key.startsWith("/")) {
      paths.push(item.key);
    }

    if (item.children?.length) {
      paths.push(...collectMenuPaths(item.children));
    }
  }

  return paths;
}

export const dashboardMenuPaths = collectMenuPaths(dashboardMenuItems);

// ============================================================
// GET SELECTED MENU
// ============================================================

export function getSelectedMenuKey(pathname: string, permissions?: string[]) {
  if (pathname === "/dashboard") {
    return "/dashboard";
  }

  const items = permissions
    ? filterDashboardMenuItems(dashboardMenuItems, permissions)
    : dashboardMenuItems;

  const allowedPaths = collectMenuPaths(items);

  /**
   * Urutkan route paling panjang terlebih dahulu.
   *
   * Contoh:
   * /dashboard/products
   * /dashboard/products/123
   *
   * Halaman detail tetap memilih menu products.
   */
  const selectedKey = allowedPaths
    .sort((a, b) => b.length - a.length)
    .find((key) => {
      return pathname === key || pathname.startsWith(`${key}/`);
    });

  return selectedKey ?? "";
}

// ============================================================
// GET DEFAULT OPEN PARENT
// ============================================================

function findParentKey(
  items: DashboardMenuItem[],
  pathname: string,
  parentKey?: string,
): string | undefined {
  for (const item of items) {
    if (
      item.key.startsWith("/") &&
      (pathname === item.key || pathname.startsWith(`${item.key}/`))
    ) {
      return parentKey;
    }

    if (item.children?.length) {
      const found = findParentKey(item.children, pathname, item.key);

      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

export function getDefaultOpenKeys(
  pathname: string,
  permissions?: string[],
): string[] {
  const items = permissions
    ? filterDashboardMenuItems(dashboardMenuItems, permissions)
    : dashboardMenuItems;

  const parentKey = findParentKey(items, pathname);

  return parentKey ? [parentKey] : [];
}
