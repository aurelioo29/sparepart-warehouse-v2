"use client";

import { useState } from "react";
import { Layout } from "antd";

import DashboardHeader from "./dashboard-header";
import DashboardSidebar from "./dashboard-sidebar";
import DashboardContent from "./dashboard-content";

type DashboardLayoutProps = {
  children: React.ReactNode;
  userName?: string | null;
  roleName?: string | null;
  permissions: string[];
};

export default function DashboardLayout({
  children,
  userName,
  roleName,
  permissions,
}: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Layout className="min-h-screen !bg-slate-50">
      <DashboardHeader userName={userName} roleName={roleName} />

      <Layout className="min-h-[calc(100vh-48px)] !bg-slate-50">
        <DashboardSidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((prev) => !prev)}
          permissions={permissions}
        />

        <DashboardContent>{children}</DashboardContent>
      </Layout>
    </Layout>
  );
}
