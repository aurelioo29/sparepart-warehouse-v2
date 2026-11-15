"use client";

import { isValidElement, useEffect, useMemo, useState } from "react";
import { Button, Layout, Menu, theme, type MenuProps } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { usePathname } from "next/navigation";
import Link from "next/link";

import {
  getDashboardMenuItems,
  getDefaultOpenKeys,
  getSelectedMenuKey,
} from "@/lib/menu/dashboard-menu";

const { Sider } = Layout;

type DashboardSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  permissions: string[];
};

type MenuItems = NonNullable<MenuProps["items"]>;
type MenuItem = MenuItems[number];

function createLinkedMenuItems(items: MenuItems): MenuItems {
  return items.map((item): MenuItem => {
    if (!item || item.type === "divider") {
      return item;
    }

    if ("children" in item && item.children) {
      return {
        ...item,
        children: createLinkedMenuItems(item.children),
      } as MenuItem;
    }

    if (!("label" in item)) {
      return item;
    }

    const route = String(item.key ?? "");

    if (!route.startsWith("/") || route.startsWith("//")) {
      return item;
    }

    if (isValidElement(item.label) && item.label.type === Link) {
      return item;
    }

    return {
      ...item,
      label: (
        <Link
          href={route}
          prefetch={false}
          className="block !text-inherit !no-underline"
        >
          {item.label}
        </Link>
      ),
    };
  });
}

export default function DashboardSidebar({
  collapsed,
  onToggleCollapsed,
  permissions,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    getDefaultOpenKeys(pathname, permissions),
  );

  const menuItems = useMemo(
    () => createLinkedMenuItems(getDashboardMenuItems(permissions) ?? []),
    [permissions],
  );

  const selectedKey = getSelectedMenuKey(pathname, permissions);

  useEffect(() => {
    const activeParentKeys = getDefaultOpenKeys(pathname, permissions);

    if (activeParentKeys.length > 0) {
      setOpenKeys(activeParentKeys);
    }
  }, [pathname, permissions]);

  function handleOpenChange(keys: string[]) {
    const latestOpenKey = keys.find((key) => !openKeys.includes(key));

    setOpenKeys(latestOpenKey ? [latestOpenKey] : []);
  }

  const siderClassName = [
    "!relative",
    "!z-50",
    "!border-r",
    "!border-slate-200",
    collapsed ? "dashboard-sidebar-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const menuContainerClassName = [
    "h-[calc(100vh-48px)]",
    "pb-12",
    "pt-3",
    collapsed ? "overflow-visible" : "overflow-y-auto",
  ].join(" ");

  return (
    <Sider
      width={260}
      collapsedWidth={64}
      collapsed={collapsed}
      trigger={null}
      className={siderClassName}
      style={{
        background: collapsed ? "#001f33" : colorBgContainer,
        overflow: "visible",
      }}
    >
      <div className={menuContainerClassName}>
        <Menu
          mode="inline"
          theme="light"
          inlineCollapsed={collapsed}
          selectedKeys={selectedKey ? [selectedKey] : []}
          openKeys={collapsed ? undefined : openKeys}
          onOpenChange={handleOpenChange}
          items={menuItems}
          className="!border-none"
          style={{
            background: "transparent",
          }}
        />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-50 flex h-12 items-center justify-center bg-[#001f33]">
        <Button
          type="text"
          aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
          title={collapsed ? "Buka sidebar" : "Tutup sidebar"}
          onClick={onToggleCollapsed}
          icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
          className="!flex !h-12 !w-full !items-center !justify-center !rounded-none !border-none !bg-transparent !text-white hover:!bg-white/10"
        />
      </div>
    </Sider>
  );
}
