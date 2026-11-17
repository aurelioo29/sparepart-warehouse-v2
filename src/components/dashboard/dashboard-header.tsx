"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Divider,
  Dropdown,
  Empty,
  Layout,
  Modal,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import {
  BellFilled,
  ExclamationCircleFilled,
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

import { useWarehouseSiteName } from "./warehouse-branding-provider";

const { Header } = Layout;
const { Text } = Typography;

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

type DashboardHeaderProps = {
  userName?: string | null;
  roleName?: string | null;
};

function getEventColor(eventType: string) {
  if (eventType === "CREATE") return "bg-emerald-500";
  if (eventType === "UPDATE") return "bg-blue-500";
  if (eventType === "DELETE") return "bg-slate-500";

  return "bg-slate-400";
}

export default function DashboardHeader({ userName }: DashboardHeaderProps) {
  const siteName = useWarehouseSiteName();
  const router = useRouter();
  const [modal, contextHolder] = Modal.useModal();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const initials = useMemo(() => {
    if (!userName) return "A";

    return userName
      .split(" ")
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("");
  }, [userName]);

  async function fetchNotifications() {
    try {
      const response = await fetch("/api/notifications?limit=5");
      const result = await response.json();

      if (!response.ok || !result.success) return;

      setNotifications(result.data.items || []);
      setUnreadCount(result.data.unreadCount || 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }

  async function markNotificationAsRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      void fetchNotifications();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  async function markAllAsRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markAll: true }),
      });

      void fetchNotifications();
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  }

  function handleLogoutConfirm() {
    modal.confirm({
      title: "Keluar dari sistem?",
      icon: <ExclamationCircleFilled />,
      content: "Anda akan keluar dari dashboard dan kembali ke halaman login.",
      okText: "Ya, Keluar",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        await signOut({
          callbackUrl: "/login",
        });
      },
    });
  }

  useEffect(() => {
    void fetchNotifications();

    const interval = setInterval(() => {
      void fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const notificationDropdown = (
    <div className="w-[360px] bg-white shadow-xl">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <div className="font-semibold text-slate-800">Notifikasi</div>
          <div className="text-xs text-slate-500">
            {unreadCount} notifikasi belum dibaca
          </div>
        </div>

        {unreadCount > 0 ? (
          <Button size="small" type="link" onClick={markAllAsRead}>
            Tandai semua
          </Button>
        ) : null}
      </div>

      <Divider className="!my-0" />

      <div className="max-h-[360px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-8">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Tidak ada notifikasi"
            />
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => markNotificationAsRead(notification.id)}
              className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
            >
              <div
                className={`mt-1 h-2.5 w-2.5 rounded-full ${getEventColor(
                  notification.eventType,
                )}`}
              />

              <div className="min-w-0 flex-1">
                <div
                  className={`truncate text-sm ${
                    notification.isRead
                      ? "font-medium text-slate-700"
                      : "font-semibold text-slate-900"
                  }`}
                >
                  {notification.title}
                </div>

                <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
                  {notification.message}
                </div>

                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                  <span>{notification.module}</span>
                  <span>•</span>
                  <span>
                    {dayjs(notification.createdAt).format("DD MMM HH:mm")}
                  </span>
                </div>
              </div>

              {!notification.isRead ? (
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
              ) : (
                <div className="mt-1 h-2 w-2 shrink-0" />
              )}
            </button>
          ))
        )}
      </div>

      <Divider className="!my-0" />

      <button
        type="button"
        onClick={() => router.push("/dashboard/notifications")}
        className="w-full px-4 py-3 text-center text-sm font-medium text-blue-600 transition hover:bg-slate-50"
      >
        Lihat semua notifikasi
      </button>
    </div>
  );

  const profileItems: MenuProps["items"] = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Lihat Profil",
      onClick: () => router.push("/dashboard/profile"),
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      danger: true,
      label: "Keluar",
      onClick: handleLogoutConfirm,
    },
  ];

  return (
    <>
      {contextHolder}

      <Header
        className="!sticky !top-0 !z-40 !h-12 !bg-[#001f33] !px-0"
        style={{ lineHeight: "normal" }}
      >
        <div className="flex h-full items-center justify-between">
          <div className="flex h-full min-w-0 items-center px-4">
            <div
              className="truncate text-sm font-semibold text-white"
              title={siteName}
            >
              {siteName}
            </div>
          </div>

          <div className="flex h-full shrink-0 items-center">
            <Dropdown
              popupRender={() => notificationDropdown}
              placement="bottomRight"
              trigger={["click"]}
            >
              <button
                type="button"
                className="flex h-12 items-center gap-2 px-3 !text-white transition hover:bg-white/10"
              >
                <div className="relative flex items-center">
                  <BellFilled className="!text-base !text-white" />

                  {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-blue-400 ring-2 ring-[#001f33]" />
                  ) : null}
                </div>

                <span className="text-sm font-medium text-white">
                  {unreadCount}
                </span>
              </button>
            </Dropdown>

            <Dropdown
              menu={{ items: profileItems }}
              placement="bottomRight"
              trigger={["click"]}
            >
              <button
                type="button"
                className="flex h-12 items-center gap-2 px-3 text-white transition hover:bg-white/10"
              >
                <Avatar
                  size={26}
                  className="!bg-orange-500 !text-xs !font-semibold"
                >
                  {initials}
                </Avatar>

                <Text className="!text-sm !font-medium !text-white">
                  {userName || "Admin"}
                </Text>

                <span className="text-xs text-white">▼</span>
              </button>
            </Dropdown>
          </div>
        </div>
      </Header>
    </>
  );
}
