"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Space, Spin, Tag } from "antd";
import { ArrowLeftOutlined, PrinterOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

type KngOrderDetailItem = {
  id: string;
  kngProductId: string;
  jenisSnapshot: string;
  partNumberSnapshot: string;
  hargaJkt: string | number;
  hargaNetto: string | number;
  quantity: number;
  totalAmount: string | number;
};

type KngOrderDetail = {
  id: string;
  orderNumber: string;
  orderDate: string;
  discountPercent: string | number;
  totalQty: number;
  totalAmount: string | number;
  status: string;
  noteFranco?: string | null;
  noteTop?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: KngOrderDetailItem[];
  createdBy?: {
    id: string;
    fullName: string;
    username: string;
    email: string;
  } | null;
};

type PrintableRow = KngOrderDetailItem & {
  rowSpan: number;
  showJenis: boolean;
  noInGroup: number;
};

type KngOrderPrintPageClientProps = {
  id: string;
};

function formatNumber(value?: string | number | null) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatLongDate(value: string | Date) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildPrintableRows(items: KngOrderDetailItem[]) {
  const rows: PrintableRow[] = [];

  let index = 0;

  while (index < items.length) {
    const currentJenis = items[index].jenisSnapshot;
    const groupItems: KngOrderDetailItem[] = [];

    while (
      index < items.length &&
      items[index].jenisSnapshot === currentJenis
    ) {
      groupItems.push(items[index]);
      index += 1;
    }

    groupItems.forEach((item, groupIndex) => {
      rows.push({
        ...item,
        rowSpan: groupIndex === 0 ? groupItems.length : 0,
        showJenis: groupIndex === 0,
        noInGroup: groupIndex + 1,
      });
    });
  }

  return rows;
}

export default function KngOrderPrintPageClient({
  id,
}: KngOrderPrintPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [order, setOrder] = useState<KngOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const printableRows = useMemo(() => {
    return buildPrintableRows(order?.items || []);
  }, [order?.items]);

  async function fetchOrder() {
    try {
      setLoading(true);

      const response = await fetch(`/api/kng-orders/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil order KNG");
      }

      setOrder(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil order KNG",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-sm print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          html,
          body {
            background: #ffffff !important;
          }

          .no-print {
            display: none !important;
          }

          .print-sheet {
            width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }

          .print-table th,
          .print-table td {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="no-print mb-4 flex justify-between">
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push(`/dashboard/kng-orders/${id}`)}
          >
            Kembali
          </Button>

          <Button
            type="primary"
            icon={<PrinterOutlined />}
            disabled={!order}
            onClick={() => window.print()}
          >
            Print
          </Button>
        </Space>

        {order ? <Tag color="green">{order.status}</Tag> : null}
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center bg-white">
          <Spin />
        </div>
      ) : order ? (
        <div className="print-sheet mx-auto w-[794px] bg-white p-8 shadow">
          <div className="text-center">
            <div className="text-2xl font-semibold underline">Orderan</div>

            <div className="mt-1 text-xl font-semibold underline">
              {order.orderNumber}
            </div>
          </div>

          <div className="mt-6">
            <table className="print-table w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="border border-black px-2 py-1" />
                  <th className="border border-black px-2 py-1" />
                  <th
                    className="border border-black bg-red-600 px-2 py-1 text-center font-bold text-black"
                    colSpan={2}
                  >
                    Product KNG
                  </th>
                  <th
                    className="border border-black bg-yellow-300 px-2 py-1"
                    colSpan={2}
                  />
                </tr>

                <tr>
                  <th className="w-[48px] border border-black px-2 py-1 text-center font-bold">
                    No
                  </th>

                  <th className="w-[160px] border border-black px-2 py-1 text-center font-bold">
                    Jenis
                  </th>

                  <th className="border border-black px-2 py-1 text-left font-bold">
                    Part Number
                  </th>

                  <th className="w-[130px] border border-black px-2 py-1 text-right font-bold">
                    Harga Netto
                  </th>

                  <th className="w-[90px] border border-black bg-yellow-300 px-2 py-1 text-right font-bold">
                    Order/pc
                  </th>

                  <th className="w-[150px] border border-black bg-yellow-300 px-2 py-1 text-right font-bold">
                    Total (Rupiah)
                  </th>
                </tr>
              </thead>

              <tbody>
                {printableRows.map((item) => (
                  <tr key={item.id}>
                    <td className="border border-black px-2 py-1 text-center font-semibold">
                      {item.noInGroup}
                    </td>

                    {item.showJenis ? (
                      <td
                        className="border border-black px-2 py-1 text-center align-middle font-bold"
                        rowSpan={item.rowSpan}
                      >
                        {item.jenisSnapshot}
                      </td>
                    ) : null}

                    <td className="border border-black px-2 py-1 font-bold">
                      {item.partNumberSnapshot}
                    </td>

                    <td className="border border-black px-2 py-1 text-right font-semibold">
                      {formatNumber(item.hargaNetto)}
                    </td>

                    <td className="border border-black px-2 py-1 text-right font-semibold">
                      {formatNumber(item.quantity)}
                    </td>

                    <td className="border border-black px-2 py-1 text-right font-bold">
                      {formatNumber(item.totalAmount)}
                    </td>
                  </tr>
                ))}

                <tr>
                  <td
                    className="border border-black px-2 py-1 text-center text-xl font-bold tracking-[0.35em]"
                    colSpan={4}
                  >
                    TOTAL
                  </td>

                  <td className="border border-black px-2 py-1 text-right text-lg font-bold">
                    {formatNumber(order.totalQty)}
                  </td>

                  <td className="border border-black px-2 py-1 text-right text-xl font-bold">
                    {formatNumber(order.totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-8 text-[13px]">
            <div className="leading-7">
              <div>Keterangan :</div>
              <div>1. {order.noteFranco || "Frangko Medan"}</div>
              <div>2. {order.noteTop || "Top = 125 hari"}</div>
            </div>

            <div className="ml-auto min-w-[220px] text-left leading-7">
              <div>Medan, {formatLongDate(order.orderDate)}</div>
              <div>TTD</div>

              <div className="h-24" />

              <div>Rudy Prasetyo</div>
            </div>
          </div>

          {order.notes ? (
            <div className="mt-6 text-xs text-slate-600">
              Catatan: {order.notes}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
