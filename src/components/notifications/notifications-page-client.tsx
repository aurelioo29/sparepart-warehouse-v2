"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Empty, Skeleton, Tag, message } from "antd";
import {
  ArrowRightOutlined,
  BellOutlined,
  CheckOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import "dayjs/locale/id";
import Link from "next/link";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  eventType: string;
  module: string;
  relatedId?: string | null;
  isRead: boolean;
  createdAt: string;
  actor?: {
    fullName?: string | null;
    username?: string | null;
  } | null;
};

type ModuleRoute = {
  label: string;
  listPath: string;
  aliases: string[];
  detailPath?: (id: string) => string;
};

type NotificationTarget = {
  href: string;
  label: string;
};

/*
 * Otomatis menambahkan ID untuk modul data.
 *
 * Contoh:
 * listPath   : /dashboard/roles
 * detailPath : /dashboard/roles/abc-123
 *
 * ID berasal dari relatedId notifikasi.
 */
function createDetailRoute(
  label: string,
  listPath: string,
  aliases: string[],
): ModuleRoute {
  return {
    label,
    listPath,
    aliases,
    detailPath: (id) => `${listPath}/${id}`,
  };
}

const MODULE_ROUTES: ModuleRoute[] = [
  // Halaman utama, tidak memakai ID.
  {
    label: "Dashboard",
    listPath: "/dashboard",
    aliases: ["dashboard", "home"],
  },

  createDetailRoute("Log aktivitas", "/dashboard/activity-logs", [
    "activity-log",
    "activity-logs",
    "activity",
    "activities",
    "audit-log",
    "audit-logs",
  ]),

  createDetailRoute("Merek", "/dashboard/brands", ["brand", "brands", "merek"]),

  createDetailRoute("Kategori", "/dashboard/categories", [
    "category",
    "categories",
    "kategori",
  ]),

  createDetailRoute("Pelanggan", "/dashboard/customers", [
    "customer",
    "customers",
    "pelanggan",
  ]),

  createDetailRoute("Pesanan KNG", "/dashboard/kng-orders", [
    "kng-order",
    "kng-orders",
    "kng",
    "pesanan-kng",
  ]),

  createDetailRoute("Produk KNG", "/dashboard/kng-products", [
    "kng-product",
    "kng-products",
    "produk-kng",
  ]),

  createDetailRoute("Notifikasi", "/dashboard/notifications", [
    "notification",
    "notifications",
    "notifikasi",
  ]),

  createDetailRoute("Utang pemasok", "/dashboard/payables", [
    "payable",
    "payables",
    "account-payable",
    "accounts-payable",
    "hutang",
    "utang",
  ]),

  createDetailRoute("Hak akses", "/dashboard/permissions", [
    "permission",
    "permissions",
    "hak-akses",
  ]),

  createDetailRoute("Produk", "/dashboard/products", [
    "product",
    "products",
    "produk",
  ]),

  createDetailRoute("Pembayaran pembelian", "/dashboard/purchase-payments", [
    "purchase-payment",
    "purchase-payments",
    "supplier-payment",
    "supplier-payments",
    "pembayaran-pembelian",
  ]),

  createDetailRoute("Pembelian", "/dashboard/purchases", [
    "purchase",
    "purchases",
    "pembelian",
  ]),

  createDetailRoute("Lokasi rak", "/dashboard/rack-locations", [
    "rack-location",
    "rack-locations",
    "rack",
    "racks",
    "lokasi-rak",
  ]),

  createDetailRoute("Tagihan pelanggan", "/dashboard/receivables", [
    "receivable",
    "receivables",
    "account-receivable",
    "accounts-receivable",
    "piutang",
  ]),

  // Halaman laporan, tidak memakai ID transaksi.
  {
    label: "Laporan",
    listPath: "/dashboard/reports",
    aliases: ["report", "reports", "laporan"],
  },

  createDetailRoute("Peran pengguna", "/dashboard/roles", [
    "role",
    "roles",
    "peran",
  ]),

  createDetailRoute("Faktur penjualan", "/dashboard/sales-invoices", [
    "sale",
    "sales",
    "sale-invoice",
    "sale-invoices",
    "sales-invoice",
    "sales-invoices",
    "invoice",
    "invoices",
    "penjualan",
  ]),

  createDetailRoute("Pembayaran penjualan", "/dashboard/sales-payments", [
    "sale-payment",
    "sale-payments",
    "sales-payment",
    "sales-payments",
    "customer-payment",
    "customer-payments",
    "pembayaran-penjualan",
  ]),

  createDetailRoute("Salesman", "/dashboard/salesmen", [
    "salesman",
    "salesmen",
    "sales-person",
    "salespeople",
  ]),

  // Halaman pengaturan, tidak memakai ID.
  {
    label: "Pengaturan",
    listPath: "/dashboard/settings",
    aliases: [
      "setting",
      "settings",
      "system-setting",
      "system-settings",
      "pengaturan",
    ],
  },

  // URL Warehouse Info sesuai yang kamu kirim.
  {
    label: "Informasi gudang",
    listPath: "/dashboard/settings/warehouse-info",
    aliases: [
      "warehouse-info",
      "warehouse-information",
      "warehouse-profile",
      "warehouse-setting",
      "warehouse-settings",
      "settings-warehouse-info",
      "informasi-gudang",
      "info-gudang",
    ],
  },

  createDetailRoute("Penyesuaian stok", "/dashboard/stock-adjustments", [
    "stock-adjustment",
    "stock-adjustments",
    "adjustment",
    "adjustments",
    "penyesuaian-stok",
  ]),

  createDetailRoute("Barang masuk", "/dashboard/stock-ins", [
    "stock-in",
    "stock-ins",
    "barang-masuk",
  ]),

  createDetailRoute("Pergerakan stok", "/dashboard/stock-movements", [
    "stock-movement",
    "stock-movements",
    "movement",
    "movements",
    "pergerakan-stok",
  ]),

  createDetailRoute("Barang keluar", "/dashboard/stock-outs", [
    "stock-out",
    "stock-outs",
    "barang-keluar",
  ]),

  createDetailRoute("Persediaan", "/dashboard/stocks", [
    "stock",
    "stocks",
    "inventory",
    "persediaan",
  ]),

  createDetailRoute("Pemasok", "/dashboard/suppliers", [
    "supplier",
    "suppliers",
    "pemasok",
  ]),

  createDetailRoute("Satuan", "/dashboard/units", ["unit", "units", "satuan"]),

  createDetailRoute("Pengguna", "/dashboard/users", [
    "user",
    "users",
    "pengguna",
  ]),

  createDetailRoute("Gudang", "/dashboard/warehouses", [
    "warehouse",
    "warehouses",
    "gudang",
  ]),
];

/*
 * Mendukung:
 * STOCK_IN
 * stock-in
 * stockIn
 * Stock In
 *
 * Semuanya menjadi "stockin".
 */
function normalizeModule(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const ROUTE_LOOKUP = new Map<string, ModuleRoute>();

for (const route of MODULE_ROUTES) {
  for (const alias of route.aliases) {
    ROUTE_LOOKUP.set(normalizeModule(alias), route);
  }

  ROUTE_LOOKUP.set(normalizeModule(route.listPath), route);
}

function findModuleRoute(module: string) {
  return ROUTE_LOOKUP.get(normalizeModule(module));
}

function isDeleteEvent(eventType: string) {
  return /(^|[^a-z])(delete|deleted|remove|removed)([^a-z]|$)/i.test(eventType);
}

function getNotificationTarget(item: NotificationItem): NotificationTarget {
  const route = findModuleRoute(item.module);

  if (!route) {
    return {
      href: "/dashboard",
      label: "Buka Dashboard",
    };
  }

  const relatedId = item.relatedId?.trim();

  if (relatedId && route.detailPath && !isDeleteEvent(item.eventType)) {
    return {
      href: route.detailPath(encodeURIComponent(relatedId)),
      label: `Lihat detail ${route.label}`,
    };
  }

  return {
    href: route.listPath,
    label: `Buka ${route.label}`,
  };
}

function getEventDisplay(eventType: string) {
  switch (eventType.trim().toUpperCase()) {
    case "CREATE":
    case "CREATED":
      return {
        label: "Ditambahkan",
        color: "green",
      };

    case "UPDATE":
    case "UPDATED":
      return {
        label: "Diperbarui",
        color: "blue",
      };

    case "DELETE":
    case "DELETED":
    case "REMOVE":
    case "REMOVED":
      return {
        label: "Dihapus",
        color: "red",
      };

    case "APPROVE":
    case "APPROVED":
      return {
        label: "Disetujui",
        color: "green",
      };

    case "CANCEL":
    case "CANCELED":
    case "CANCELLED":
      return {
        label: "Dibatalkan",
        color: "orange",
      };

    case "PAYMENT":
    case "PAID":
      return {
        label: "Pembayaran",
        color: "purple",
      };

    default:
      return {
        label: eventType || "Aktivitas",
        color: "default",
      };
  }
}

function formatDate(value: string) {
  if (!dayjs(value).isValid()) return "—";

  return dayjs(value).locale("id").format("DD MMM YYYY, HH:mm");
}

export default function NotificationsPageClient() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const busyRef = useRef(false);
  const requestIdRef = useRef(0);

  const fetchNotifications = useCallback(
    async (signal?: AbortSignal) => {
      const requestId = ++requestIdRef.current;

      try {
        setLoading(true);

        const response = await fetch("/api/notifications?limit=50", {
          cache: "no-store",
          signal,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Gagal mengambil notifikasi");
        }

        if (signal?.aborted || requestId !== requestIdRef.current) {
          return;
        }

        setNotifications(result.data.items || []);
        setUnreadCount(Number(result.data.unreadCount || 0));
      } catch (error) {
        if (signal?.aborted || requestId !== requestIdRef.current) {
          return;
        }

        messageApi.error(
          error instanceof Error ? error.message : "Gagal mengambil notifikasi",
        );
      } finally {
        if (!signal?.aborted && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [messageApi],
  );

  useEffect(() => {
    const controller = new AbortController();

    void fetchNotifications(controller.signal);

    return () => controller.abort();
  }, [fetchNotifications]);

  async function updateReadStatus(body: { id?: string; markAll?: boolean }) {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Gagal memperbarui notifikasi");
    }
  }

  function updateLocalRead(item: NotificationItem) {
    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === item.id
          ? { ...notification, isRead: true }
          : notification,
      ),
    );

    if (!item.isRead) {
      setUnreadCount((previous) => Math.max(0, previous - 1));
    }
  }

  async function handleMarkAsRead(item: NotificationItem) {
    if (busyRef.current || loading || item.isRead) {
      return;
    }

    busyRef.current = true;
    setProcessingId(item.id);

    try {
      await updateReadStatus({ id: item.id });
      updateLocalRead(item);
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : "Gagal menandai notifikasi",
      );
    } finally {
      busyRef.current = false;
      setProcessingId(null);
    }
  }

  async function handleOpen(item: NotificationItem) {
    if (busyRef.current || loading) return;

    const target = getNotificationTarget(item);

    busyRef.current = true;
    setProcessingId(item.id);

    try {
      if (!item.isRead) {
        await updateReadStatus({ id: item.id });
        updateLocalRead(item);
      }
    } catch {
      messageApi.warning("Status baca belum tersimpan");
    } finally {
      busyRef.current = false;
      setProcessingId(null);
    }

    router.push(target.href);
  }

  async function handleMarkAll() {
    if (busyRef.current || loading || unreadCount === 0) {
      return;
    }

    busyRef.current = true;
    setMarkingAll(true);

    try {
      await updateReadStatus({ markAll: true });

      setNotifications((previous) =>
        previous.map((item) => ({
          ...item,
          isRead: true,
        })),
      );

      setUnreadCount(0);

      messageApi.success("Semua notifikasi ditandai dibaca");
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : "Gagal memperbarui notifikasi",
      );
    } finally {
      busyRef.current = false;
      setMarkingAll(false);
    }
  }

  const busy = processingId !== null || markingAll;

  return (
    <div className="min-w-0 space-y-4">
      {contextHolder}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-xl font-bold text-slate-900">Notifikasi</h1>

            {unreadCount > 0 ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                {unreadCount} belum dibaca
              </span>
            ) : null}
          </div>

          <p className="mb-0 mt-1 text-xs leading-5 text-slate-500">
            Pilih notifikasi untuk membuka halaman terkait.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="small"
            icon={<CheckOutlined />}
            loading={markingAll}
            disabled={loading || processingId !== null || unreadCount === 0}
            onClick={() => void handleMarkAll()}
          >
            Baca semua
          </Button>

          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={busy}
            onClick={() => {
              void fetchNotifications();
            }}
          >
            Perbarui
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-5 p-4">
            {[1, 2, 3].map((item) => (
              <Skeleton
                key={item}
                active
                title={{ width: "45%" }}
                paragraph={{ rows: 2 }}
              />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8">
            <Empty description="Belum ada notifikasi" />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((item) => {
              const event = getEventDisplay(item.eventType);

              const target = getNotificationTarget(item);

              const moduleRoute = findModuleRoute(item.module);

              const actor = item.actor?.fullName || item.actor?.username;

              return (
                <article
                  key={item.id}
                  className={item.isRead ? "bg-white" : "bg-blue-50/50"}
                >
                  <Link
                    href={target.href}
                    onClick={() => {
                      if (!item.isRead) {
                        void handleMarkAsRead(item);
                      }
                    }}
                    aria-label={`${item.title}. ${target.label}`}
                    className="
                      flex w-full cursor-pointer
                      items-start gap-3 p-3.5
                      text-left no-underline transition
                      hover:bg-blue-50
                      focus-visible:outline-2
                      focus-visible:outline-blue-500
                      md:p-4
                    "
                  >
                    <span
                      className={`
                        mt-0.5 flex h-9 w-9
                        shrink-0 items-center
                        justify-center rounded-xl
                        ${
                          item.isRead
                            ? "bg-slate-100 text-slate-400"
                            : "bg-blue-100 text-blue-600"
                        }
                      `}
                    >
                      {processingId === item.id ? (
                        <ReloadOutlined spin />
                      ) : (
                        <BellOutlined />
                      )}
                    </span>

                    <span className="block min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">
                          {item.title}
                        </span>

                        <Tag color={event.color} className="!m-0">
                          {event.label}
                        </Tag>

                        {!item.isRead ? (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                            Baru
                          </span>
                        ) : null}
                      </span>

                      <span className="mt-1 block whitespace-pre-line text-xs leading-5 text-slate-600 [overflow-wrap:anywhere]">
                        {item.message}
                      </span>

                      <span className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-400">
                        <span>
                          {moduleRoute?.label || item.module || "Umum"}
                        </span>

                        {actor ? <span>{actor}</span> : null}

                        <span>{formatDate(item.createdAt)}</span>
                      </span>

                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600">
                        {target.label}
                        <ArrowRightOutlined />
                      </span>
                    </span>
                  </Link>

                  {!item.isRead ? (
                    <div className="flex justify-end px-3.5 pb-2.5 md:px-4">
                      <Button
                        size="small"
                        type="text"
                        icon={<CheckOutlined />}
                        loading={processingId === item.id}
                        disabled={busy}
                        onClick={() => {
                          void handleMarkAsRead(item);
                        }}
                      >
                        Tandai dibaca
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {notifications.length > 0 ? (
        <p className="m-0 text-center text-[11px] text-slate-400">
          Menampilkan hingga 50 notifikasi terbaru.
        </p>
      ) : null}
    </div>
  );
}
