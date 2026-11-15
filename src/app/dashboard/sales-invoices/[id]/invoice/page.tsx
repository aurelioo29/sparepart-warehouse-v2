import Image from "next/image";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/permissions";
import InvoicePrintActions from "@/components/invoices/invoice-print-actions";

type InvoicePageProps = {
  params: Promise<{
    id: string;
  }>;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value || 0);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    return Number(value.toString());
  }

  return Number(value || 0);
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(new Date(value));
}

function settingValueToString(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

async function getGeneralSettings() {
  const settings = await prisma.generalSetting.findMany({
    where: {
      key: {
        in: [
          "warehouse_name",
          "warehouse_logo_url",
          "warehouse_address",
          "warehouse_phone",
          "warehouse_email",
          "warehouse_tax_number",
        ],
      },
    },
    select: {
      key: true,
      value: true,
    },
  });

  return settings.reduce<Record<string, string>>((acc, item) => {
    acc[item.key] = settingValueToString(item.value);
    return acc;
  }, {});
}

export default async function SaleInvoicePage({ params }: InvoicePageProps) {
  const auth = await requirePermission("sales.view");

  if (!auth.authorized) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-sm">
        <div className="mx-auto max-w-4xl bg-white p-6">
          You are not authorized to view this invoice.
        </div>
      </main>
    );
  }

  const { id } = await params;

  const [sale, settings] = await Promise.all([
    prisma.sale.findUnique({
      where: {
        id,
      },
      include: {
        customer: true,
        salesman: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: {
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                  },
                },
              },
            },
            warehouse: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            rackLocation: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        payments: {
          orderBy: {
            paymentDate: "asc",
          },
        },
      },
    }),

    getGeneralSettings(),
  ]);

  if (!sale) {
    notFound();
  }

  const companyName = settings.warehouse_name || "Sparepart Warehouse";

  const logoUrl = settings.warehouse_logo_url || "";
  const address = settings.warehouse_address || "-";
  const phone = settings.warehouse_phone || "-";
  const email = settings.warehouse_email || "-";
  const taxNumber = settings.warehouse_tax_number || "";

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-sm print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl">
        <InvoicePrintActions />

        <div className="invoice-paper bg-white p-8 shadow-sm print:shadow-none">
          <div className="mb-8 flex items-start justify-between border-b border-slate-200 pb-6">
            <div className="flex items-start gap-4">
              {logoUrl ? (
                <div className="relative h-16 w-16 overflow-hidden border border-slate-200">
                  <Image
                    src={logoUrl}
                    alt={companyName}
                    fill
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center border border-slate-200 text-xs font-bold text-slate-500">
                  LOGO
                </div>
              )}

              <div>
                <h1 className="m-0 text-xl font-bold text-slate-900">
                  {companyName}
                </h1>

                <div className="mt-1 max-w-md text-xs leading-5 text-slate-600">
                  <div>{address}</div>
                  <div>Phone: {phone}</div>
                  <div>Email: {email}</div>
                  {taxNumber && <div>Tax No: {taxNumber}</div>}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900">INVOICE</div>

              <div className="mt-1 text-sm font-semibold text-blue-600">
                {sale.invoiceNumber}
              </div>

              <div className="mt-2 text-xs text-slate-500">
                Status: {sale.status}
              </div>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-8">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Bill To
              </div>

              <div className="font-semibold text-slate-900">
                {sale.customer?.name || "Walk-in Customer"}
              </div>

              <div className="mt-1 text-xs leading-5 text-slate-600">
                <div>Type: {sale.customer?.customerType || "-"}</div>
                <div>Phone: {sale.customer?.phone || "-"}</div>
                <div>Email: {sale.customer?.email || "-"}</div>
                <div>Address: {sale.customer?.address || "-"}</div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Invoice Info
              </div>

              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="py-1 text-slate-500">Invoice Date</td>
                    <td className="py-1 text-right font-medium">
                      {formatDate(sale.saleDate)}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-1 text-slate-500">Due Date</td>
                    <td className="py-1 text-right font-medium">
                      {formatDate(sale.dueDate)}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-1 text-slate-500">Salesman</td>
                    <td className="py-1 text-right font-medium">
                      {sale.salesman?.name || "-"}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-1 text-slate-500">Payment Status</td>
                    <td className="py-1 text-right font-medium">
                      {sale.paymentStatus}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <table className="mb-8 w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-200 px-3 py-2">No</th>
                <th className="border border-slate-200 px-3 py-2">SKU</th>
                <th className="border border-slate-200 px-3 py-2">Item</th>
                <th className="border border-slate-200 px-3 py-2 text-right">
                  Qty
                </th>
                <th className="border border-slate-200 px-3 py-2 text-right">
                  Price
                </th>
                <th className="border border-slate-200 px-3 py-2 text-right">
                  Discount
                </th>
                <th className="border border-slate-200 px-3 py-2 text-right">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {sale.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="border border-slate-200 px-3 py-2">
                    {index + 1}
                  </td>

                  <td className="border border-slate-200 px-3 py-2">
                    {item.product.sku}
                  </td>

                  <td className="border border-slate-200 px-3 py-2">
                    <div className="font-medium text-slate-900">
                      {item.product.name}
                    </div>

                    <div className="text-[11px] text-slate-500">
                      {item.warehouse?.name || "-"} /{" "}
                      {item.rackLocation?.name || "-"}
                    </div>
                  </td>

                  <td className="border border-slate-200 px-3 py-2 text-right">
                    {item.quantity} {item.product.unit.shortName}
                  </td>

                  <td className="border border-slate-200 px-3 py-2 text-right">
                    {formatCurrency(item.unitPrice)}
                  </td>

                  <td className="border border-slate-200 px-3 py-2 text-right">
                    {formatCurrency(item.discountAmount)}
                  </td>

                  <td className="border border-slate-200 px-3 py-2 text-right font-medium">
                    {formatCurrency(item.totalPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-start justify-between gap-8">
            <div className="w-1/2">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Notes
              </div>

              <div className="min-h-20 border border-slate-200 p-3 text-xs leading-5 text-slate-600">
                {sale.notes || "-"}
              </div>

              {sale.payments.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Payment History
                  </div>

                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-200 px-2 py-1 text-left">
                          Date
                        </th>
                        <th className="border border-slate-200 px-2 py-1 text-left">
                          Method
                        </th>
                        <th className="border border-slate-200 px-2 py-1 text-right">
                          Amount
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {sale.payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="border border-slate-200 px-2 py-1">
                            {formatDate(payment.paymentDate)}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            {payment.method}
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-right">
                            {formatCurrency(payment.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="w-80">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="border-b border-slate-200 py-2 text-slate-600">
                      Subtotal
                    </td>
                    <td className="border-b border-slate-200 py-2 text-right font-medium">
                      {formatCurrency(sale.subtotal)}
                    </td>
                  </tr>

                  <tr>
                    <td className="border-b border-slate-200 py-2 text-slate-600">
                      Discount
                    </td>
                    <td className="border-b border-slate-200 py-2 text-right font-medium">
                      {formatCurrency(sale.discountAmount)}
                    </td>
                  </tr>

                  <tr>
                    <td className="border-b border-slate-200 py-2 text-slate-900">
                      Total
                    </td>
                    <td className="border-b border-slate-200 py-2 text-right text-base font-bold text-slate-900">
                      {formatCurrency(sale.totalAmount)}
                    </td>
                  </tr>

                  <tr>
                    <td className="border-b border-slate-200 py-2 text-slate-600">
                      Paid
                    </td>
                    <td className="border-b border-slate-200 py-2 text-right font-medium">
                      {formatCurrency(sale.paidAmount)}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2 text-slate-900">Remaining</td>
                    <td className="py-2 text-right text-base font-bold text-red-600">
                      {formatCurrency(sale.remainingAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-12 text-center text-xs">
            <div>
              <div className="mb-16">Received By,</div>
              <div className="border-t border-slate-300 pt-2">Customer</div>
            </div>

            <div>
              <div className="mb-16">Prepared By,</div>
              <div className="border-t border-slate-300 pt-2">
                {sale.createdBy?.fullName || "Admin"}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-500">
            Thank you for your purchase.
          </div>
        </div>
      </div>
    </main>
  );
}
