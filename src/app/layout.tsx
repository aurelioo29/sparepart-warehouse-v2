import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider } from "antd";

import { prisma } from "@/lib/prisma";

import "./globals.css";

async function getWarehouseInfoForLayout() {
  try {
    const warehouseInfo = await prisma.warehouseInfo.findFirst({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        storeName: true,
        logoUrl: true,
        city: true,
        province: true,
        updatedAt: true,
      },
    });

    return warehouseInfo;
  } catch (error) {
    console.error("Failed to load warehouse info for layout:", error);
    return null;
  }
}

function getAbsoluteUrl(value?: string | null) {
  if (!value) return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL ||
    "";

  if (!appUrl) return value;

  const baseUrl = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;

  return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const warehouseInfo = await getWarehouseInfoForLayout();

  const siteName = warehouseInfo?.storeName || "Sparepart Warehouse";

  const location = [warehouseInfo?.city, warehouseInfo?.province]
    .filter(Boolean)
    .join(", ");

  const description = location
    ? `${siteName} - Warehouse stock management system in ${location}`
    : "Warehouse stock management system";

  const logoUrl = warehouseInfo?.logoUrl
    ? `${getAbsoluteUrl(warehouseInfo.logoUrl)}?v=${
        warehouseInfo.updatedAt?.getTime() || Date.now()
      }`
    : "";

  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description,
    applicationName: siteName,
    icons: logoUrl
      ? {
          icon: [
            {
              url: logoUrl,
              type: "image/png",
            },
          ],
          shortcut: [
            {
              url: logoUrl,
              type: "image/png",
            },
          ],
          apple: [
            {
              url: logoUrl,
              type: "image/png",
            },
          ],
        }
      : undefined,
    openGraph: {
      title: siteName,
      description,
      type: "website",
      images: logoUrl
        ? [
            {
              url: logoUrl,
              alt: siteName,
            },
          ]
        : undefined,
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
                Button: {
                  controlHeight: 40,
                },
                Input: {
                  controlHeight: 40,
                },
                Select: {
                  controlHeight: 40,
                },
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
