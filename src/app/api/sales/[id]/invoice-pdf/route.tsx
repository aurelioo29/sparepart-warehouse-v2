import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";

import { pdf } from "@react-pdf/renderer";

import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/permissions";
import SaleInvoicePdf from "@/components/invoices/pdf/sale-invoice-pdf";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type WarehouseInfoForPdf = {
  storeName?: string | null;
  ownerName?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  invoiceFooter?: string | null;
  bankAccounts?: {
    id: string;
    bankName: string;
    accountNumber: string;
    logoUrl?: string | null;
  }[];
};

type InvoiceSaleForPdf = {
  invoiceNumber: string;
  saleDate: Date | string;
  dueDate?: Date | string | null;
  status: string;
  paymentStatus: string;
  subtotal: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  paidAmount: string | number;
  notes?: string | null;
  customer?: {
    name?: string | null;
    customerType?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
  salesman?: {
    name?: string | null;
  } | null;
  createdBy?: {
    fullName?: string | null;
    username?: string | null;
  } | null;
  items: {
    id: string;
    quantity: number;
    unitPrice: string | number;
    discountPercent: string | number;
    discountQty: number;
    additionalDiscountPercent: string | number;
    additionalDiscountPercent2: string | number;
    discountAmount: string | number;
    totalPrice: string | number;
    product: {
      sku: string;
      name: string;
      category?: {
        name?: string | null;
      } | null;
      unit: {
        shortName: string;
      };
    };
  }[];
  payments: {
    id: string;
    paymentDate: Date | string;
    amount: string | number;
    method: string;
  }[];
};

function safeFilename(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-");
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return 0;

  if (typeof value === "number") return value;

  if (typeof value === "string") return Number(value || 0);

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

function getMimeTypeFromFilePath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";

  return "image/png";
}

async function logoUrlToDataUri(logoUrl?: string | null) {
  if (!logoUrl) return null;

  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    return logoUrl;
  }

  const cleanLogoUrl = logoUrl.startsWith("/") ? logoUrl.slice(1) : logoUrl;

  const possiblePaths = [
    path.join(process.cwd(), "public", cleanLogoUrl),
    path.join(process.cwd(), cleanLogoUrl),
  ];

  const filePath = possiblePaths.find((item) => existsSync(item));

  if (!filePath) {
    console.warn(`Invoice logo file not found: ${logoUrl}`);
    return null;
  }

  const fileBuffer = await readFile(filePath);
  const mimeType = getMimeTypeFromFilePath(filePath);

  return `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
}

async function getWarehouseInfoForPdf(): Promise<WarehouseInfoForPdf> {
  const warehouseInfo = await prisma.warehouseInfo.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      storeName: true,
      ownerName: true,
      logoUrl: true,
      phone: true,
      email: true,
      address: true,
      city: true,
      province: true,
      postalCode: true,
      invoiceFooter: true,
      bankAccounts: {
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          id: true,
          bankName: true,
          accountNumber: true,
          logoUrl: true,
        },
      },
    },
  });

  if (!warehouseInfo) {
    return {};
  }

  const logoDataUri = await logoUrlToDataUri(warehouseInfo.logoUrl);
  const bankAccounts = await Promise.all(
    warehouseInfo.bankAccounts.map(async (account) => ({
      id: account.id,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      logoUrl: await logoUrlToDataUri(account.logoUrl),
    })),
  );

  return {
    storeName: warehouseInfo.storeName,
    ownerName: warehouseInfo.ownerName,
    logoUrl: logoDataUri,
    phone: warehouseInfo.phone,
    email: warehouseInfo.email,
    address: warehouseInfo.address,
    city: warehouseInfo.city,
    province: warehouseInfo.province,
    postalCode: warehouseInfo.postalCode,
    invoiceFooter: warehouseInfo.invoiceFooter,
    bankAccounts,
  };
}

function normalizeSaleForInvoice(sale: {
  invoiceNumber: string;
  saleDate: Date;
  dueDate: Date | null;
  status: string;
  paymentStatus: string;
  subtotal: unknown;
  discountAmount: unknown;
  totalAmount: unknown;
  paidAmount: unknown;
  notes: string | null;
  customer: {
    name: string;
    customerType: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  salesman: {
    name: string;
  } | null;
  createdBy: {
    fullName: string | null;
    username: string | null;
  };
  items: {
    id: string;
    quantity: unknown;
    unitPrice: unknown;
    discountPercent: unknown;
    discountQty: unknown;
    additionalDiscountPercent: unknown;
    additionalDiscountPercent2: unknown;
    discountAmount: unknown;
    totalPrice: unknown;
    product: {
      sku: string;
      name: string;
      category: {
        name: string;
      } | null;
      unit: {
        shortName: string;
      };
    };
  }[];
  payments: {
    id: string;
    paymentDate: Date;
    amount: unknown;
    method: string;
  }[];
}): InvoiceSaleForPdf {
  return {
    invoiceNumber: sale.invoiceNumber,
    saleDate: sale.saleDate,
    dueDate: sale.dueDate,
    status: sale.status,
    paymentStatus: sale.paymentStatus,
    subtotal: decimalToNumber(sale.subtotal),
    discountAmount: decimalToNumber(sale.discountAmount),
    totalAmount: decimalToNumber(sale.totalAmount),
    paidAmount: decimalToNumber(sale.paidAmount),
    notes: sale.notes,

    customer: sale.customer
      ? {
          name: sale.customer.name,
          customerType: sale.customer.customerType,
          phone: sale.customer.phone,
          email: sale.customer.email,
          address: sale.customer.address,
        }
      : null,

    salesman: sale.salesman
      ? {
          name: sale.salesman.name,
        }
      : null,

    createdBy: sale.createdBy
      ? {
          fullName: sale.createdBy.fullName,
          username: sale.createdBy.username,
        }
      : null,

    items: sale.items.map((item) => ({
      id: item.id,
      quantity: decimalToNumber(item.quantity),
      unitPrice: decimalToNumber(item.unitPrice),
      discountPercent: decimalToNumber(item.discountPercent),
      discountQty: decimalToNumber(item.discountQty),
      additionalDiscountPercent: decimalToNumber(
        item.additionalDiscountPercent,
      ),
      additionalDiscountPercent2: decimalToNumber(
        item.additionalDiscountPercent2,
      ),
      discountAmount: decimalToNumber(item.discountAmount),
      totalPrice: decimalToNumber(item.totalPrice),
      product: {
        sku: item.product.sku,
        name: item.product.name,
        category: item.product.category
          ? {
              name: item.product.category.name,
            }
          : null,
        unit: {
          shortName: item.product.unit.shortName,
        },
      },
    })),

    payments: sale.payments.map((payment) => ({
      id: payment.id,
      paymentDate: payment.paymentDate,
      amount: decimalToNumber(payment.amount),
      method: payment.method,
    })),
  };
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requirePermission("sales.view");

    if (!auth.authorized) {
      return errorResponse({
        message: auth.message,
        status: auth.status,
      });
    }

    const { id } = await context.params;

    const [sale, warehouseInfo] = await Promise.all([
      prisma.sale.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          invoiceNumber: true,
          saleDate: true,
          dueDate: true,
          status: true,
          paymentStatus: true,
          subtotal: true,
          discountAmount: true,
          totalAmount: true,
          paidAmount: true,
          notes: true,

          customer: {
            select: {
              name: true,
              customerType: true,
              phone: true,
              email: true,
              address: true,
            },
          },

          salesman: {
            select: {
              name: true,
            },
          },

          createdBy: {
            select: {
              fullName: true,
              username: true,
            },
          },

          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              discountPercent: true,
              discountQty: true,
              additionalDiscountPercent: true,
              additionalDiscountPercent2: true,
              discountAmount: true,
              totalPrice: true,
              createdAt: true,

              product: {
                select: {
                  sku: true,
                  name: true,

                  category: {
                    select: {
                      name: true,
                    },
                  },

                  unit: {
                    select: {
                      shortName: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },

          payments: {
            select: {
              id: true,
              paymentDate: true,
              amount: true,
              method: true,
            },
            orderBy: {
              paymentDate: "asc",
            },
          },
        },
      }),

      getWarehouseInfoForPdf(),
    ]);

    if (!sale) {
      return errorResponse({
        message: "Sale tidak ditemukan",
        status: 404,
      });
    }

    // Gunakan urutan item langsung dari database (createdAt ASC),
    // sama seperti urutan pada halaman detail dan urutan saat diinput.
    const invoiceSale = normalizeSaleForInvoice(sale);

    const blob = await pdf(
      <SaleInvoicePdf sale={invoiceSale} settings={warehouseInfo} />,
    ).toBlob();

    const arrayBuffer = await blob.arrayBuffer();

    const filename = `invoice-${safeFilename(sale.invoiceNumber)}.pdf`;

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("GET /api/sales/[id]/invoice-pdf error:", error);

    return errorResponse({
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate invoice PDF",
      status: 500,
      errors: error instanceof Error ? error.message : error,
    });
  }
}
