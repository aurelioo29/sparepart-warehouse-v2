"use client";

import { useState } from "react";
import { Button, Dropdown, message } from "antd";
import {
  DownOutlined,
  FilePdfOutlined,
  PrinterOutlined,
} from "@ant-design/icons";

type PrintInvoiceButtonProps = {
  saleId: string;
  disabled?: boolean;
};

export default function PrintInvoiceButton({
  saleId,
  disabled = false,
}: PrintInvoiceButtonProps) {
  const [printing, setPrinting] = useState(false);

  async function handlePrintInvoice() {
    try {
      setPrinting(true);

      const response = await fetch(`/api/sales/${saleId}/invoice-pdf`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Gagal mengambil invoice PDF");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const iframe = document.createElement("iframe");

      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = blobUrl;

      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();

          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }

            URL.revokeObjectURL(blobUrl);
            setPrinting(false);
          }, 1500);
        }, 500);
      };
    } catch (error) {
      console.error(error);
      setPrinting(false);

      message.error(
        error instanceof Error ? error.message : "Gagal print invoice",
      );
    }
  }

  function handleDownloadPdf() {
    window.open(`/api/sales/${saleId}/invoice-pdf`, "_blank");
  }

  return (
    <Dropdown
      trigger={["click"]}
      disabled={disabled || printing}
      menu={{
        items: [
          {
            key: "print",
            icon: <PrinterOutlined />,
            label: "Print Invoice",
            onClick: handlePrintInvoice,
          },
          {
            key: "pdf",
            icon: <FilePdfOutlined />,
            label: "Download PDF",
            onClick: handleDownloadPdf,
          },
        ],
      }}
    >
      <Button
        size="small"
        icon={<PrinterOutlined />}
        loading={printing}
        disabled={disabled}
      >
        Print Invoice <DownOutlined className="text-[10px]" />
      </Button>
    </Dropdown>
  );
}
