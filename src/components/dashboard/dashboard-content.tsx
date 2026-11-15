"use client";

import { useEffect, useRef } from "react";
import { Layout } from "antd";
import { usePathname } from "next/navigation";

import DashboardBreadcrumb from "./dashboard-breadcrumb";

const { Content } = Layout;

type DashboardContentProps = {
  children: React.ReactNode;
};

export default function DashboardContent({ children }: DashboardContentProps) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, [pathname]);

  return (
    <Layout className="!bg-slate-50">
      <div
        ref={scrollRef}
        className="h-[calc(100vh-64px)] overflow-y-auto px-6 py-6"
      >
        <DashboardBreadcrumb />

        <Content className="border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </Content>
      </div>
    </Layout>
  );
}
