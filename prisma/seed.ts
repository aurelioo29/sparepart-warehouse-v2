import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const permissions = [
  // Dashboard
  {
    name: "View Dashboard",
    key: "dashboard.view",
    module: "dashboard",
  },

  // Users
  {
    name: "View Users",
    key: "users.view",
    module: "users",
  },
  {
    name: "Create Users",
    key: "users.create",
    module: "users",
  },
  {
    name: "Update Users",
    key: "users.update",
    module: "users",
  },
  {
    name: "Delete Users",
    key: "users.delete",
    module: "users",
  },

  // Roles
  {
    name: "View Roles",
    key: "roles.view",
    module: "roles",
  },
  {
    name: "Create Roles",
    key: "roles.create",
    module: "roles",
  },
  {
    name: "Update Roles",
    key: "roles.update",
    module: "roles",
  },
  {
    name: "Delete Roles",
    key: "roles.delete",
    module: "roles",
  },

  // Permissions
  {
    name: "View Permissions",
    key: "permissions.view",
    module: "permissions",
  },
  {
    name: "Update Permissions",
    key: "permissions.update",
    module: "permissions",
  },

  // Settings
  {
    name: "View Settings",
    key: "settings.view",
    module: "settings",
  },
  {
    name: "Update Settings",
    key: "settings.update",
    module: "settings",
  },

  // Activity Logs
  {
    name: "View Activity Logs",
    key: "activity_logs.view",
    module: "activity_logs",
  },

  // Notifications
  {
    name: "View Notifications",
    key: "notifications.view",
    module: "notifications",
  },
  {
    name: "Update Notifications",
    key: "notifications.update",
    module: "notifications",
  },

  // Warehouse Info
  {
    name: "View Warehouse Info",
    key: "warehouse_infos.view",
    module: "warehouse_infos",
  },
  {
    name: "Update Warehouse Info",
    key: "warehouse_infos.update",
    module: "warehouse_infos",
  },

  // Categories
  {
    name: "View Categories",
    key: "categories.view",
    module: "categories",
  },
  {
    name: "Create Categories",
    key: "categories.create",
    module: "categories",
  },
  {
    name: "Update Categories",
    key: "categories.update",
    module: "categories",
  },
  {
    name: "Delete Categories",
    key: "categories.delete",
    module: "categories",
  },
  {
    name: "Delete Permanent Categories",
    key: "categories.delete_permanent",
    module: "categories",
  },

  // Brands
  {
    name: "View Brands",
    key: "brands.view",
    module: "brands",
  },
  {
    name: "Create Brands",
    key: "brands.create",
    module: "brands",
  },
  {
    name: "Update Brands",
    key: "brands.update",
    module: "brands",
  },
  {
    name: "Delete Brands",
    key: "brands.delete",
    module: "brands",
  },
  {
    name: "Delete Permanent Brands",
    key: "brands.delete_permanent",
    module: "brands",
  },

  // Units
  {
    name: "View Units",
    key: "units.view",
    module: "units",
  },
  {
    name: "Create Units",
    key: "units.create",
    module: "units",
  },
  {
    name: "Update Units",
    key: "units.update",
    module: "units",
  },
  {
    name: "Delete Units",
    key: "units.delete",
    module: "units",
  },
  {
    name: "Delete Permanent Units",
    key: "units.delete_permanent",
    module: "units",
  },

  // Suppliers
  {
    name: "View Suppliers",
    key: "suppliers.view",
    module: "suppliers",
  },
  {
    name: "Create Suppliers",
    key: "suppliers.create",
    module: "suppliers",
  },
  {
    name: "Update Suppliers",
    key: "suppliers.update",
    module: "suppliers",
  },
  {
    name: "Delete Suppliers",
    key: "suppliers.delete",
    module: "suppliers",
  },
  {
    name: "Delete Permanent Suppliers",
    key: "suppliers.delete_permanent",
    module: "suppliers",
  },

  // Warehouses
  {
    name: "View Warehouses",
    key: "warehouses.view",
    module: "warehouses",
  },
  {
    name: "Create Warehouses",
    key: "warehouses.create",
    module: "warehouses",
  },
  {
    name: "Update Warehouses",
    key: "warehouses.update",
    module: "warehouses",
  },
  {
    name: "Delete Warehouses",
    key: "warehouses.delete",
    module: "warehouses",
  },
  {
    name: "Delete Permanent Warehouses",
    key: "warehouses.delete_permanent",
    module: "warehouses",
  },

  // Rack Locations
  {
    name: "View Rack Locations",
    key: "rack_locations.view",
    module: "rack_locations",
  },
  {
    name: "Create Rack Locations",
    key: "rack_locations.create",
    module: "rack_locations",
  },
  {
    name: "Update Rack Locations",
    key: "rack_locations.update",
    module: "rack_locations",
  },
  {
    name: "Delete Rack Locations",
    key: "rack_locations.delete",
    module: "rack_locations",
  },
  {
    name: "Delete Permanent Rack Locations",
    key: "rack_locations.delete_permanent",
    module: "rack_locations",
  },

  // Customers
  {
    name: "View Customers",
    key: "customers.view",
    module: "customers",
  },
  {
    name: "Create Customers",
    key: "customers.create",
    module: "customers",
  },
  {
    name: "Update Customers",
    key: "customers.update",
    module: "customers",
  },
  {
    name: "Delete Customers",
    key: "customers.delete",
    module: "customers",
  },
  {
    name: "Delete Permanent Customers",
    key: "customers.delete_permanent",
    module: "customers",
  },

  // Salesmen
  {
    name: "View Salesmen",
    key: "salesmen.view",
    module: "salesmen",
  },
  {
    name: "Create Salesmen",
    key: "salesmen.create",
    module: "salesmen",
  },
  {
    name: "Update Salesmen",
    key: "salesmen.update",
    module: "salesmen",
  },
  {
    name: "Delete Salesmen",
    key: "salesmen.delete",
    module: "salesmen",
  },
  {
    name: "Delete Permanent Salesmen",
    key: "salesmen.delete_permanent",
    module: "salesmen",
  },

  // Products
  {
    name: "View Products",
    key: "products.view",
    module: "products",
  },
  {
    name: "Create Products",
    key: "products.create",
    module: "products",
  },
  {
    name: "Update Products",
    key: "products.update",
    module: "products",
  },
  {
    name: "Delete Products",
    key: "products.delete",
    module: "products",
  },
  {
    name: "Delete Permanent Products",
    key: "products.delete_permanent",
    module: "products",
  },

  // KNG Products
  {
    name: "View KNG Products",
    key: "kng-products.view",
    module: "kng-products",
  },
  {
    name: "Create KNG Products",
    key: "kng-products.create",
    module: "kng-products",
  },
  {
    name: "Update KNG Products",
    key: "kng-products.update",
    module: "kng-products",
  },
  {
    name: "Delete KNG Products",
    key: "kng-products.delete",
    module: "kng-products",
  },
  {
    name: "Delete Permanent KNG Products",
    key: "kng-products.delete_permanent",
    module: "kng-products",
  },

  // KNG Orders
  {
    name: "View KNG Orders",
    key: "kng-orders.view",
    module: "kng-orders",
  },
  {
    name: "Create KNG Orders",
    key: "kng-orders.create",
    module: "kng-orders",
  },
  {
    name: "Update KNG Orders",
    key: "kng-orders.update",
    module: "kng-orders",
  },
  {
    name: "Delete KNG Orders",
    key: "kng-orders.delete",
    module: "kng-orders",
  },
  {
    name: "Delete Permanent KNG Orders",
    key: "kng-orders.delete_permanent",
    module: "kng-orders",
  },
  {
    name: "Print KNG Orders",
    key: "kng-orders.print",
    module: "kng-orders",
  },
  {
    name: "Export KNG Orders",
    key: "kng-orders.export",
    module: "kng-orders",
  },

  // Stock In
  {
    name: "View Stock In",
    key: "stock_ins.view",
    module: "stock_ins",
  },
  {
    name: "Create Stock In",
    key: "stock_ins.create",
    module: "stock_ins",
  },
  {
    name: "Update Stock In",
    key: "stock_ins.update",
    module: "stock_ins",
  },
  {
    name: "Delete Stock In",
    key: "stock_ins.delete",
    module: "stock_ins",
  },

  // Stock Out
  {
    name: "View Stock Out",
    key: "stock_outs.view",
    module: "stock_outs",
  },
  {
    name: "Create Stock Out",
    key: "stock_outs.create",
    module: "stock_outs",
  },
  {
    name: "Update Stock Out",
    key: "stock_outs.update",
    module: "stock_outs",
  },
  {
    name: "Delete Stock Out",
    key: "stock_outs.delete",
    module: "stock_outs",
  },

  // Sales
  {
    name: "View Sales",
    key: "sales.view",
    module: "sales",
  },
  {
    name: "Create Sales",
    key: "sales.create",
    module: "sales",
  },
  {
    name: "Update Sales",
    key: "sales.update",
    module: "sales",
  },
  {
    name: "Delete Sales",
    key: "sales.delete",
    module: "sales",
  },

  // Sale Payments
  {
    name: "View Sale Payments",
    key: "sale_payments.view",
    module: "sale_payments",
  },
  {
    name: "Create Sale Payments",
    key: "sale_payments.create",
    module: "sale_payments",
  },
  {
    name: "Update Sale Payments",
    key: "sale_payments.update",
    module: "sale_payments",
  },
  {
    name: "Delete Sale Payments",
    key: "sale_payments.delete",
    module: "sale_payments",
  },

  // Stock Movements
  {
    name: "View Stock Movements",
    key: "stock_movements.view",
    module: "stock_movements",
  },

  // Stock Adjustments
  {
    name: "View Stock Adjustments",
    key: "stock_adjustments.view",
    module: "stock_adjustments",
  },
  {
    name: "Create Stock Adjustments",
    key: "stock_adjustments.create",
    module: "stock_adjustments",
  },
  {
    name: "Delete Stock Adjustments",
    key: "stock_adjustments.delete",
    module: "stock_adjustments",
  },

  // Stocks
  {
    name: "View Stocks",
    key: "stocks.view",
    module: "stocks",
  },

  // Receivables
  {
    name: "View Receivables",
    key: "receivables.view",
    module: "receivables",
  },
  {
    name: "Export Receivables",
    key: "receivables.export",
    module: "receivables",
  },

  // Reports
  {
    name: "View Inventory Report",
    key: "reports.inventory.view",
    module: "reports",
  },
  {
    name: "Export Inventory Report",
    key: "reports.inventory.export",
    module: "reports",
  },
  {
    name: "View Stock In Report",
    key: "reports.stock_in.view",
    module: "reports",
  },
  {
    name: "Export Stock In Report",
    key: "reports.stock_in.export",
    module: "reports",
  },
  {
    name: "View Stock Out Report",
    key: "reports.stock_out.view",
    module: "reports",
  },
  {
    name: "Export Stock Out Report",
    key: "reports.stock_out.export",
    module: "reports",
  },
  {
    name: "View Salesman Report",
    key: "reports.salesman.view",
    module: "reports",
  },
  {
    name: "Export Salesman Report",
    key: "reports.salesman.export",
    module: "reports",
  },

  // Purchase Payments
  {
    name: "View Purchase Payments",
    key: "purchase_payments.view",
    module: "purchase_payments",
  },
  {
    name: "Create Purchase Payments",
    key: "purchase_payments.create",
    module: "purchase_payments",
  },
  {
    name: "Update Purchase Payments",
    key: "purchase_payments.update",
    module: "purchase_payments",
  },
  {
    name: "Delete Purchase Payments",
    key: "purchase_payments.delete",
    module: "purchase_payments",
  },

  // Payables
  {
    name: "View Payables",
    key: "payables.view",
    module: "payables",
  },
  {
    name: "Export Payables",
    key: "payables.export",
    module: "payables",
  },
];

const rolePermissions = {
  superadmin: "ALL",

  owner: [
    "dashboard.view",

    "settings.view",
    "warehouse_infos.view",
    "activity_logs.view",

    "notifications.view",
    "notifications.update",

    "categories.view",
    "brands.view",
    "units.view",
    "suppliers.view",
    "warehouses.view",
    "rack_locations.view",
    "customers.view",
    "salesmen.view",
    "products.view",

    "kng-products.view",

    "stock_ins.view",
    "stock_outs.view",
    "stock_movements.view",
    "stock_adjustments.view",
    "stocks.view",

    "sales.view",
    "sale_payments.view",
    "receivables.view",

    "kng-orders.view",
    "kng-orders.print",
    "kng-orders.export",

    "reports.inventory.view",
    "reports.inventory.export",
    "reports.stock_in.view",
    "reports.stock_in.export",
    "reports.stock_out.view",
    "reports.stock_out.export",
    "reports.salesman.view",
    "reports.salesman.export",
  ],

  "admin-gudang": [
    "dashboard.view",

    "warehouse_infos.view",
    "warehouse_infos.update",

    "notifications.view",
    "notifications.update",
    "activity_logs.view",

    "categories.view",
    "categories.create",
    "categories.update",

    "brands.view",
    "brands.create",
    "brands.update",

    "units.view",
    "units.create",
    "units.update",

    "suppliers.view",
    "suppliers.create",
    "suppliers.update",

    "warehouses.view",
    "warehouses.create",
    "warehouses.update",

    "rack_locations.view",
    "rack_locations.create",
    "rack_locations.update",

    "customers.view",
    "customers.create",
    "customers.update",

    "salesmen.view",
    "salesmen.create",
    "salesmen.update",

    "products.view",
    "products.create",
    "products.update",

    "kng-products.view",
    "kng-products.create",
    "kng-products.update",
    "kng-products.delete",

    "stock_ins.view",
    "stock_ins.create",
    "stock_ins.update",

    "stock_outs.view",
    "stock_outs.create",
    "stock_outs.update",

    "stock_adjustments.view",
    "stock_adjustments.create",
    "stock_adjustments.delete",

    "stock_movements.view",
    "stocks.view",

    "sales.view",
    "sales.create",
    "sales.update",

    "sale_payments.view",
    "sale_payments.create",
    "sale_payments.update",

    "receivables.view",

    "kng-orders.view",
    "kng-orders.create",
    "kng-orders.update",
    "kng-orders.delete",
    "kng-orders.print",
    "kng-orders.export",

    "reports.inventory.view",
    "reports.stock_in.view",
    "reports.stock_out.view",
    "reports.salesman.view",
  ],

  "staff-gudang": [
    "dashboard.view",

    "notifications.view",
    "notifications.update",

    "categories.view",
    "brands.view",
    "units.view",
    "suppliers.view",
    "warehouses.view",
    "rack_locations.view",
    "products.view",

    "kng-products.view",

    "stock_ins.view",
    "stock_ins.create",

    "stock_outs.view",
    "stock_outs.create",

    "stock_adjustments.view",
    "stock_adjustments.create",

    "stock_movements.view",
    "stocks.view",

    "kng-orders.view",
    "kng-orders.create",
    "kng-orders.print",
  ],
} as const;

async function seedRoles() {
  const roles = [
    {
      name: "Superadmin",
      slug: "superadmin",
      description: "Full access to all system features",
    },
    {
      name: "Owner",
      slug: "owner",
      description:
        "Business owner access for monitoring reports, stock, sales, and receivables",
    },
    {
      name: "Admin Gudang",
      slug: "admin-gudang",
      description:
        "Warehouse administrator access for master data and inventory operations",
    },
    {
      name: "Staff Gudang",
      slug: "staff-gudang",
      description: "Warehouse staff access for daily stock in and stock out",
    },
  ];

  const result: Record<
    string,
    Awaited<ReturnType<typeof prisma.role.upsert>>
  > = {};

  for (const role of roles) {
    const createdRole = await prisma.role.upsert({
      where: {
        slug: role.slug,
      },
      update: {
        name: role.name,
        description: role.description,
        isActive: true,
      },
      create: {
        name: role.name,
        slug: role.slug,
        description: role.description,
        isActive: true,
      },
    });

    result[role.slug] = createdRole;
  }

  return result;
}

async function seedPermissions() {
  const uniquePermissions = Array.from(
    new Map(
      permissions.map((permission) => [permission.key, permission]),
    ).values(),
  );

  for (const permission of uniquePermissions) {
    await prisma.permission.upsert({
      where: {
        key: permission.key,
      },
      update: {
        name: permission.name,
        module: permission.module,
      },
      create: {
        name: permission.name,
        key: permission.key,
        module: permission.module,
      },
    });
  }
}

async function syncRolePermissions(
  roleId: string,
  permissionKeys: string[] | "ALL",
) {
  const selectedPermissions =
    permissionKeys === "ALL"
      ? await prisma.permission.findMany()
      : await prisma.permission.findMany({
          where: {
            key: {
              in: permissionKeys,
            },
          },
        });

  await prisma.rolePermission.deleteMany({
    where: {
      roleId,
    },
  });

  if (selectedPermissions.length === 0) return;

  await prisma.rolePermission.createMany({
    data: selectedPermissions.map((permission) => ({
      roleId,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });
}

async function seedRolePermissions(
  roles: Record<string, Awaited<ReturnType<typeof prisma.role.upsert>>>,
) {
  await syncRolePermissions(roles.superadmin.id, rolePermissions.superadmin);
  await syncRolePermissions(roles.owner.id, [...rolePermissions.owner]);
  await syncRolePermissions(roles["admin-gudang"].id, [
    ...rolePermissions["admin-gudang"],
  ]);
  await syncRolePermissions(roles["staff-gudang"].id, [
    ...rolePermissions["staff-gudang"],
  ]);
}

async function seedSuperadminOnce() {
  const username = "superadmin";
  const existingUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (existingUser) {
    console.log("Akun superadmin sudah ada. Pembuatan akun dilewati.");
    return;
  }

  const email = process.env.SUPERADMIN_EMAIL?.trim();
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Isi SUPERADMIN_EMAIL dan SUPERADMIN_PASSWORD terlebih dahulu.",
    );
  }

  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Password minimal 12 karakter dan maksimal 72 byte.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const created = await prisma.$transaction(async (tx) => {
    const role = await tx.role.upsert({
      where: { slug: "superadmin" },
      update: {},
      create: {
        name: "Superadmin",
        slug: "superadmin",
        description: "Full access to all system features",
        isActive: true,
      },
    });

    const allPermissions = await tx.permission.findMany({
      select: { id: true },
    });

    await tx.rolePermission.createMany({
      data: allPermissions.map(({ id }) => ({
        roleId: role.id,
        permissionId: id,
      })),
      skipDuplicates: true,
    });

    const result = await tx.user.createMany({
      data: [
        {
          roleId: role.id,
          fullName: "Superadmin",
          username,
          email,
          passwordHash,
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });

    if (result.count === 1) return true;

    const account = await tx.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!account) {
      throw new Error("Akun gagal dibuat. Periksa apakah email sudah dipakai.");
    }

    return false;
  });

  console.log(
    created
      ? "Akun superadmin berhasil dibuat."
      : "Akun superadmin sudah ada. Pembuatan akun dilewati.",
  );
}

async function seedWarehouseInfo() {
  await prisma.warehouseInfo.upsert({
    where: {
      id: "00000000-0000-0000-0000-000000000001",
    },
    update: {
      storeName: "Sparepart Warehouse",
      ownerName: "Owner",
      phone: "08123456789",
      email: "admin@example.com",
      address: "Alamat gudang belum diatur",
      city: "Medan",
      province: "Sumatera Utara",
      invoiceFooter:
        "Terima kasih. Barang yang sudah keluar harap dicek kembali.",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      storeName: "Sparepart Warehouse",
      ownerName: "Owner",
      phone: "08123456789",
      email: "admin@example.com",
      address: "Alamat gudang belum diatur",
      city: "Medan",
      province: "Sumatera Utara",
      invoiceFooter:
        "Terima kasih. Barang yang sudah keluar harap dicek kembali.",
    },
  });
}

async function seedGeneralSettings() {
  const settings = [
    {
      key: "app_name",
      value: "Sparepart Warehouse",
      type: "string",
      group: "app",
      description: "Nama aplikasi",
      isPublic: true,
    },
    {
      key: "default_currency",
      value: "IDR",
      type: "string",
      group: "finance",
      description: "Mata uang default",
      isPublic: true,
    },
    {
      key: "stock_in_prefix",
      value: "IN",
      type: "string",
      group: "numbering",
      description: "Prefix nomor dokumen barang masuk",
      isPublic: false,
    },
    {
      key: "stock_out_prefix",
      value: "OUT",
      type: "string",
      group: "numbering",
      description: "Prefix nomor dokumen barang keluar",
      isPublic: false,
    },
    {
      key: "sales_invoice_prefix",
      value: "INV",
      type: "string",
      group: "numbering",
      description: "Prefix nomor invoice penjualan",
      isPublic: false,
    },
    {
      key: "kng_order_prefix",
      value: "KNG",
      type: "string",
      group: "numbering",
      description: "Prefix nomor order KNG",
      isPublic: false,
    },
    {
      key: "kng_order_default_discount_percent",
      value: "30",
      type: "number",
      group: "kng",
      description: "Default diskon harga netto order KNG",
      isPublic: false,
    },
    {
      key: "default_payment_due_days",
      value: "30",
      type: "number",
      group: "sales",
      description: "Default jatuh tempo pembayaran penjualan utang",
      isPublic: false,
    },
    {
      key: "allow_negative_stock",
      value: "false",
      type: "boolean",
      group: "inventory",
      description: "Izinkan stok menjadi minus",
      isPublic: false,
    },
    {
      key: "low_stock_notification_enabled",
      value: "true",
      type: "boolean",
      group: "notification",
      description: "Aktifkan notifikasi stok menipis",
      isPublic: false,
    },
  ];

  for (const setting of settings) {
    await prisma.generalSetting.upsert({
      where: {
        key: setting.key,
      },
      update: {
        value: setting.value,
        type: setting.type,
        group: setting.group,
        description: setting.description,
        isPublic: setting.isPublic,
      },
      create: {
        key: setting.key,
        value: setting.value,
        type: setting.type,
        group: setting.group,
        description: setting.description,
        isPublic: setting.isPublic,
      },
    });
  }
}

async function seedMasterData() {
  const categories = [
    { name: "Oli", slug: "oli" },
    { name: "Ban", slug: "ban" },
    { name: "Busi", slug: "busi" },
    { name: "Kampas Rem", slug: "kampas-rem" },
    { name: "Aki", slug: "aki" },
    { name: "Rantai", slug: "rantai" },
    { name: "Gear", slug: "gear" },
    { name: "Filter Udara", slug: "filter-udara" },
    { name: "Body Part", slug: "body-part" },
    { name: "Aksesoris", slug: "aksesoris" },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: {
        slug: category.slug,
      },
      update: {
        name: category.name,
        isActive: true,
      },
      create: {
        name: category.name,
        slug: category.slug,
        isActive: true,
      },
    });
  }

  const brands = [
    { name: "Honda", slug: "honda" },
    { name: "Yamaha", slug: "yamaha" },
    { name: "Suzuki", slug: "suzuki" },
    { name: "Kawasaki", slug: "kawasaki" },
    { name: "Aspira", slug: "aspira" },
    { name: "Federal", slug: "federal" },
    { name: "NGK", slug: "ngk" },
    { name: "Denso", slug: "denso" },
    { name: "IRC", slug: "irc" },
    { name: "Michelin", slug: "michelin" },
  ];

  for (const brand of brands) {
    await prisma.brand.upsert({
      where: {
        slug: brand.slug,
      },
      update: {
        name: brand.name,
        isActive: true,
      },
      create: {
        name: brand.name,
        slug: brand.slug,
        isActive: true,
      },
    });
  }

  const units = [
    { name: "Pieces", shortName: "pcs" },
    { name: "Set", shortName: "set" },
    { name: "Box", shortName: "box" },
    { name: "Botol", shortName: "botol" },
    { name: "Liter", shortName: "liter" },
    { name: "Pair", shortName: "pair" },
  ];

  for (const unit of units) {
    await prisma.unit.upsert({
      where: {
        shortName: unit.shortName,
      },
      update: {
        name: unit.name,
        isActive: true,
      },
      create: {
        name: unit.name,
        shortName: unit.shortName,
        isActive: true,
      },
    });
  }

  const warehouse = await prisma.warehouse.upsert({
    where: {
      code: "WH-UTAMA",
    },
    update: {
      name: "Gudang Utama",
      description: "Gudang utama sparepart",
      isActive: true,
    },
    create: {
      name: "Gudang Utama",
      code: "WH-UTAMA",
      description: "Gudang utama sparepart",
      isActive: true,
    },
  });

  const rackLocations = [
    { name: "Rak Oli", code: "RAK-OLI" },
    { name: "Rak Busi", code: "RAK-BUSI" },
    { name: "Rak Ban", code: "RAK-BAN" },
    { name: "Rak Kampas Rem", code: "RAK-KAMPAS-REM" },
    { name: "Rak Aki", code: "RAK-AKI" },
    { name: "Rak Aksesoris", code: "RAK-AKSESORIS" },
  ];

  for (const rack of rackLocations) {
    await prisma.rackLocation.upsert({
      where: {
        code: rack.code,
      },
      update: {
        name: rack.name,
        warehouseId: warehouse.id,
        isActive: true,
      },
      create: {
        name: rack.name,
        code: rack.code,
        warehouseId: warehouse.id,
        isActive: true,
      },
    });
  }
}

async function seedKngProducts() {
  const kngProducts = [
    // V-Belt Only
    {
      jenis: "V-Belt Only",
      partNumber: "B65 - Aerox",
      hargaJkt: 100000,
    },
    {
      jenis: "V-Belt Only",
      partNumber: "2DP - Nmax",
      hargaJkt: 100000,
    },
    {
      jenis: "V-Belt Only",
      partNumber: "K44 - Beat",
      hargaJkt: 63000,
    },
    {
      jenis: "V-Belt Only",
      partNumber: "KZL - Beat Fi",
      hargaJkt: 63000,
    },
    {
      jenis: "V-Belt Only",
      partNumber: "KOJ - Scoopy",
      hargaJkt: 98000,
    },
    {
      jenis: "V-Belt Only",
      partNumber: "STL - Mio",
      hargaJkt: 63000,
    },
    {
      jenis: "V-Belt Only",
      partNumber: "54P - MIO J",
      hargaJkt: 63000,
    },
    {
      jenis: "V-Belt Only",
      partNumber: "K35 - Vario 150",
      hargaJkt: 103000,
    },

    // Kampas Rem Depan / Dis Pad
    {
      jenis: "Kampas Rem Depan / Dis Pad",
      partNumber: "Cbs Vario",
      hargaJkt: 12000,
    },
    {
      jenis: "Kampas Rem Depan / Dis Pad",
      partNumber: "Mio M3",
      hargaJkt: 12000,
    },
    {
      jenis: "Kampas Rem Depan / Dis Pad",
      partNumber: "Jupiter Mx",
      hargaJkt: 12000,
    },
    {
      jenis: "Kampas Rem Depan / Dis Pad",
      partNumber: "Blade",
      hargaJkt: 12000,
    },
    {
      jenis: "Kampas Rem Depan / Dis Pad",
      partNumber: "Supra",
      hargaJkt: 15000,
    },
    {
      jenis: "Kampas Rem Depan / Dis Pad",
      partNumber: "Satria 150",
      hargaJkt: 15000,
    },
    {
      jenis: "Kampas Rem Depan / Dis Pad",
      partNumber: "Genio",
      hargaJkt: 15000,
    },
    {
      jenis: "Kampas Rem Depan / Dis Pad",
      partNumber: "PCX New",
      hargaJkt: 15000,
    },
    {
      jenis: "Kampas Rem Depan / Dis Pad",
      partNumber: "Vario 150 Esp",
      hargaJkt: 15000,
    },

    // Lahar / Bearing
    {
      jenis: "Lahar / Bearing",
      partNumber: "6201 ZZ",
      hargaJkt: 10000,
    },
    {
      jenis: "Lahar / Bearing",
      partNumber: "6300 ZZ",
      hargaJkt: 10000,
    },
    {
      jenis: "Lahar / Bearing",
      partNumber: "6301 ZZ",
      hargaJkt: 10000,
    },
    {
      jenis: "Lahar / Bearing",
      partNumber: "6202 ZZ",
      hargaJkt: 10000,
    },
    {
      jenis: "Lahar / Bearing",
      partNumber: "6203 ZZ",
      hargaJkt: 15000,
    },
    {
      jenis: "Lahar / Bearing",
      partNumber: "6004 ZZ",
      hargaJkt: 15000,
    },

    // Spark Plug / Busi
    {
      jenis: "Spark Plug / Busi",
      partNumber: "CR7HSP",
      hargaJkt: 15000,
    },
    {
      jenis: "Spark Plug / Busi",
      partNumber: "CPR9ZA",
      hargaJkt: 15000,
    },

    // Injektor
    {
      jenis: "Injektor",
      partNumber: "Beat Pop Fi / Beat ESP PI (16450-K03-N31)",
      hargaJkt: 132000,
    },
    {
      jenis: "Injektor",
      partNumber: "Vario 150 (16450-K59-A11)",
      hargaJkt: 132000,
    },
    {
      jenis: "Injektor",
      partNumber: "Vario 160 / PCX 160 (16450-K12-N21)",
      hargaJkt: 132000,
    },
    {
      jenis: "Injektor",
      partNumber: "Beat Fi / Scoopy Fi (16450-K25-901)",
      hargaJkt: 132000,
    },
    {
      jenis: "Injektor",
      partNumber: "Genio (16450-K0J-N01)",
      hargaJkt: 132000,
    },
    {
      jenis: "Injektor",
      partNumber: "Vario 125 Cbs (16450-KZR-B21)",
      hargaJkt: 132000,
    },
    {
      jenis: "Injektor",
      partNumber: "Mio M3 (2PH-E3770-00)",
      hargaJkt: 144000,
    },
    {
      jenis: "Injektor",
      partNumber: "N max / King Old (5D7-E3770-00)",
      hargaJkt: 144000,
    },
    {
      jenis: "Injektor",
      partNumber: "Lexi (2DM-E3770-01)",
      hargaJkt: 144000,
    },
    {
      jenis: "Injektor",
      partNumber: "Mio J / Mio Soul GT (54P-E3770-00)",
      hargaJkt: 144000,
    },

    // Rotak / Saringan Fuel Pump
    {
      jenis: "Rotak / Saringan Fuel Pump",
      partNumber: "Genio (16700-K0J-N01)",
      hargaJkt: 98000,
    },
    {
      jenis: "Rotak / Saringan Fuel Pump",
      partNumber: "Beat Fi (16700-K16-305-N01)",
      hargaJkt: 98000,
    },
    {
      jenis: "Rotak / Saringan Fuel Pump",
      partNumber: "Mio J (54P-E3907-10)",
      hargaJkt: 132000,
    },
    {
      jenis: "Rotak / Saringan Fuel Pump",
      partNumber: "Vario 150 (16700-K59-A71)",
      hargaJkt: 103000,
    },
  ];

  for (const product of kngProducts) {
    await prisma.kngProduct.upsert({
      where: {
        jenis_partNumber: {
          jenis: product.jenis,
          partNumber: product.partNumber,
        },
      },
      update: {
        hargaJkt: product.hargaJkt,
        isActive: true,
      },
      create: {
        jenis: product.jenis,
        partNumber: product.partNumber,
        hargaJkt: product.hargaJkt,
        isActive: true,
      },
    });
  }
}

async function main() {
  const bootstrapSuperadmin = process.argv.includes("--bootstrap-superadmin");

  if (bootstrapSuperadmin) {
    const [target] = await prisma.$queryRaw<
      Array<{ database_name: string; role_name: string }>
    >`SELECT current_database() AS database_name, current_user AS role_name`;

    if (
      target?.database_name !== "battery_warehouse" ||
      target.role_name !== "battery_app"
    ) {
      throw new Error(
        "Bootstrap hanya bisa dijalankan pada database Battery dengan user battery_app.",
      );
    }
  }

  await seedPermissions();

  if (bootstrapSuperadmin) {
    await seedSuperadminOnce();
  }

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error("Seed failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
