"use client";

import { Button, Space } from "antd";
import { ArrowLeftOutlined, PrinterOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

export default function InvoicePrintActions() {
  const router = useRouter();

  return (
    <div className="no-print mb-4 flex items-center justify-between">
      <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
        Back
      </Button>

      <Space>
        <Button
          type="primary"
          icon={<PrinterOutlined />}
          onClick={() => window.print()}
        >
          Print Invoice
        </Button>
      </Space>
    </div>
  );
}
