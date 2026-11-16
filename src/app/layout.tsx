import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider } from "antd";

import {
  getWarehouseInfoForLayout,
  getWarehouseSiteName,
} from "@/lib/warehouse-branding";

import "./globals.css";

function getLogoUrl(value?: string | null, updatedAt?: Date | null) {
  const logoUrl = value?.trim();
  if (!logoUrl) return undefined;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  const baseUrl = appUrl
    ? /^https?:\/\//i.test(appUrl)
      ? appUrl
      : `https://${appUrl}`
    : undefined;

  try {
    const url = new URL(logoUrl, baseUrl);

    if (updatedAt) {
      url.searchParams.set("v", String(updatedAt.getTime()));
    }

    return url.toString();
  } catch {
    return logoUrl;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const warehouseInfo = await getWarehouseInfoForLayout();
  const siteName = getWarehouseSiteName(warehouseInfo?.storeName);

  const location = [warehouseInfo?.city, warehouseInfo?.province]
    .filter(Boolean)
    .join(", ");

  const description = location
    ? `${siteName} - Warehouse stock management system in ${location}`
    : "Warehouse stock management system";

  const logoUrl = getLogoUrl(warehouseInfo?.logoUrl, warehouseInfo?.updatedAt);

  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description,
    applicationName: siteName,
    icons: logoUrl
      ? {
          icon: [{ url: logoUrl }],
          shortcut: [{ url: logoUrl }],
          apple: [{ url: logoUrl }],
        }
      : undefined,
    openGraph: {
      title: siteName,
      description,
      type: "website",
      images: logoUrl ? [{ url: logoUrl, alt: siteName }] : undefined,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-slate-50 text-slate-900">
        <AntdRegistry>
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: "#2563eb",
                borderRadius: 10,
                fontFamily:
                  "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
              },
              components: {
                Button: { controlHeight: 40 },
                Input: { controlHeight: 40 },
                Select: { controlHeight: 40 },
              },
            }}
          >
            <App>{children}</App>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
