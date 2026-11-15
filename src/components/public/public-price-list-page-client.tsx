"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Drawer, Empty, Input, Select, Spin } from "antd";
import {
  FilterOutlined,
  LeftOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
} from "@ant-design/icons";

type CategoryOption = {
  id: string;
  name: string;
};

type PriceListItem = {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  sellingPrice: number;
  category?: {
    id: string;
    name: string;
  } | null;
  brand?: {
    id: string;
    name: string;
  } | null;
  unit?: {
    id: string;
    name: string;
    shortName: string;
  } | null;
};

type PriceListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type PriceListResponse = {
  items: PriceListItem[];
  categories: CategoryOption[];
  meta: PriceListMeta;
};

type FetchParams = {
  page?: number;
  search?: string;
  categoryId?: string;
  limit?: number;
};

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatNumber(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function StockBadge({ stock }: { stock: number }) {
  const color =
    stock <= 0
      ? "bg-red-100 text-red-700"
      : stock <= 5
        ? "bg-orange-100 text-orange-700"
        : "bg-emerald-50 text-emerald-700";

  return (
    <span
      className={`
        inline-flex max-w-full flex-wrap items-center
        gap-x-1 rounded px-1.5 py-0.5
        text-[11px] font-semibold
        ${color}
      `}
    >
      {stock <= 0 ? "Habis" : `Stok ${formatNumber(stock)}`}
      {stock > 0 && stock <= 5 ? " · Menipis" : ""}
    </span>
  );
}

function groupProductsByCategory(items: PriceListItem[]) {
  const map = new Map<string, PriceListItem[]>();

  for (const item of items) {
    const categoryName = item.category?.name || "Tanpa Kategori";

    const existing = map.get(categoryName) || [];

    existing.push(item);
    map.set(categoryName, existing);
  }

  return Array.from(map.entries()).map(([categoryName, products]) => ({
    categoryName,
    products,
  }));
}

export default function PublicPriceListPageClient() {
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);

  const [meta, setMeta] = useState<PriceListMeta>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const requestId = useRef(0);

  const activeFilters = useRef({
    search: "",
    categoryId: "",
  });

  const groupedItems = useMemo(() => groupProductsByCategory(items), [items]);

  async function fetchPriceList(params?: FetchParams) {
    const currentRequest = ++requestId.current;

    try {
      setLoading(true);
      setError(null);

      const nextPage = params?.page ?? page;
      const nextLimit = params?.limit ?? limit;

      const nextSearch = params?.search ?? activeFilters.current.search;

      const nextCategoryId =
        params?.categoryId ?? activeFilters.current.categoryId;

      const query = new URLSearchParams({
        page: String(nextPage),
        limit: String(nextLimit),
        search: nextSearch,
        categoryId: nextCategoryId,
      });

      const response = await fetch(`/api/public/price-list?${query}`);

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil price list");
      }

      const data: PriceListResponse = result.data;

      if (currentRequest !== requestId.current) return;

      activeFilters.current = {
        search: nextSearch,
        categoryId: nextCategoryId,
      };

      setItems(data.items || []);
      setCategories(data.categories || []);
      setMeta(data.meta);
      setPage(data.meta.page);
      setLimit(data.meta.limit);
    } catch (error) {
      if (currentRequest !== requestId.current) return;

      setError(
        error instanceof Error ? error.message : "Gagal mengambil price list",
      );
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }

  function handleSearch() {
    void fetchPriceList({
      page: 1,
      search,
      categoryId,
      limit,
    });
  }

  function handleReset() {
    setSearch("");
    setCategoryId("");

    void fetchPriceList({
      page: 1,
      search: "",
      categoryId: "",
      limit,
    });
  }

  function handleNextPage() {
    if (loading || page >= meta.totalPages) return;

    void fetchPriceList({
      page: page + 1,
    });
  }

  function handlePrevPage() {
    if (loading || page <= 1) return;

    void fetchPriceList({
      page: page - 1,
    });
  }

  useEffect(() => {
    void fetchPriceList({
      page: 1,
      search: "",
      categoryId: "",
      limit: 50,
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categorySelect = (
    <Select
      allowClear
      showSearch
      placeholder="Semua kategori"
      optionFilterProp="label"
      value={categoryId || undefined}
      onChange={(value) => {
        setCategoryId(value || "");
      }}
      options={categories.map((item) => ({
        label: item.name,
        value: item.id,
      }))}
      className="w-full"
      size="middle"
      style={{
        height: 34,
      }}
      aria-label="Kategori produk"
    />
  );

  return (
    <main
      className="
        min-h-dvh bg-[#F3F8FF] text-slate-900
        pb-[calc(88px+env(safe-area-inset-bottom))]
        md:pb-6
      "
    >
      <header
        className="
          sticky top-0 z-20 border-b border-blue-100
          bg-white/95 backdrop-blur
        "
      >
        <div
          className="
            mx-auto max-w-[1280px]
            px-3 py-1.5 md:px-5 md:py-2
          "
        >
          <form
            className="flex min-w-0 items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              handleSearch();
            }}
          >
            <div className="min-w-0 flex-1">
              <Input
                size="middle"
                allowClear
                placeholder="Cari produk / SKU / brand"
                value={search}
                prefix={<SearchOutlined className="text-slate-400" />}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                aria-label="Cari produk, SKU, atau brand"
                style={{
                  height: 34,
                  minHeight: 0,
                  padding: "0 10px",
                  fontSize: 13,
                }}
                className="
                  !h-[34px]
                  !min-h-0
                  !py-0
                  [&_input]:!h-auto
                  [&_input]:!min-h-0
                  [&_input]:!py-0
                  [&_input]:!text-[13px]
                  [&_input]:!leading-5
                "
              />
            </div>

            <div className="hidden w-64 md:block">{categorySelect}</div>

            <Button
              size="middle"
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{
                height: 34,
                minHeight: 0,
                padding: "0 12px",
                fontSize: 13,
                boxShadow: "none",
              }}
            >
              Cari
            </Button>

            <div className="hidden md:block">
              <Button
                size="middle"
                style={{ height: 34 }}
                onClick={handleReset}
                disabled={loading}
              >
                Reset
              </Button>
            </div>

            <div className="hidden md:block">
              <Button
                size="middle"
                style={{ height: 34 }}
                icon={<ReloadOutlined />}
                disabled={loading}
                onClick={() => {
                  void fetchPriceList();
                }}
                aria-label="Perbarui daftar"
              />
            </div>
          </form>

          <div
            className="
              mt-1 flex items-center justify-between
              gap-2 text-[11px] leading-4 text-slate-500
              md:text-xs
            "
            aria-live="polite"
          >
            <span>
              <strong className="text-slate-800">
                {formatNumber(meta.total)}
              </strong>{" "}
              produk
            </span>

            <span>
              Halaman {meta.page} / {Math.max(1, meta.totalPages)}
            </span>
          </div>
        </div>
      </header>

      <div
        className="
          mx-auto max-w-[1280px]
          px-2 py-2 md:px-5 md:py-4
        "
        aria-busy={loading}
      >
        {error ? (
          <Alert
            type="error"
            showIcon
            message={error}
            action={
              <Button
                size="small"
                onClick={() => {
                  void fetchPriceList();
                }}
              >
                Coba lagi
              </Button>
            }
          />
        ) : null}

        {loading ? (
          <div className="flex min-h-60 items-center justify-center">
            <Spin />
          </div>
        ) : !error && groupedItems.length === 0 ? (
          <div className="rounded-lg border border-blue-100 bg-white p-6">
            <Empty description="Produk tidak ditemukan" />
          </div>
        ) : (
          <div className="space-y-2 md:space-y-4">
            {groupedItems.map((group) => (
              <section
                key={group.categoryName}
                className="
                  overflow-hidden rounded-lg
                  border border-blue-100 bg-white
                "
              >
                <div
                  className="
                    flex items-center justify-between
                    gap-2 border-b border-blue-100
                    bg-[#EAF3FF] px-3 py-2
                  "
                >
                  <h2
                    className="
                      m-0 min-w-0 text-xs font-bold
                      uppercase leading-5 tracking-wide
                      [overflow-wrap:anywhere]
                      md:text-sm
                    "
                  >
                    {group.categoryName}
                  </h2>

                  <span className="shrink-0 text-[11px] text-slate-500">
                    {group.products.length} item
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {group.products.map((item) => {
                    const isOutOfStock = item.currentStock <= 0;

                    const isLowStock =
                      item.currentStock > 0 && item.currentStock <= 5;

                    const rowColor = isOutOfStock
                      ? "border-red-500 bg-red-50/70"
                      : isLowStock
                        ? "border-orange-400 bg-orange-50/50"
                        : "border-transparent";

                    return (
                      <article
                        key={item.id}
                        className={`
                          grid min-w-0
                          grid-cols-[minmax(0,1fr)_minmax(0,1fr)]
                          items-center gap-x-2 gap-y-1
                          border-l-[3px] px-2.5 py-2
                          md:grid-cols-[minmax(0,1fr)_140px_160px]
                          md:gap-x-4 md:px-4 md:py-3
                          ${rowColor}
                        `}
                      >
                        <div
                          className="
                            col-span-2 min-w-0
                            md:col-span-1 md:row-span-2
                          "
                        >
                          <h3
                            className={`
                              m-0 whitespace-normal
                              text-[13px] font-semibold
                              leading-[1.45]
                              [overflow-wrap:anywhere]
                              md:text-sm
                              ${
                                isOutOfStock ? "text-red-700" : "text-slate-900"
                              }
                            `}
                          >
                            {item.name}
                          </h3>

                          <div
                            className="
                              mt-0.5 flex flex-wrap
                              gap-x-1.5 text-[11px]
                              leading-4 text-slate-500
                              [overflow-wrap:anywhere]
                              md:text-xs
                            "
                          >
                            <span className="font-mono">{item.sku}</span>

                            {item.brand?.name ? (
                              <span>· {item.brand.name}</span>
                            ) : null}

                            {item.unit?.shortName ? (
                              <span>· {item.unit.shortName}</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="min-w-0 md:row-span-2 md:text-right">
                          <StockBadge stock={item.currentStock} />
                        </div>

                        <div
                          className="
                            min-w-0 text-right
                            text-[13px] font-bold
                            leading-5 text-blue-600
                            [overflow-wrap:anywhere]
                            md:row-span-2 md:text-base
                          "
                        >
                          {formatCurrency(item.sellingPrice)}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <div
          className="
            mt-4 hidden items-center justify-between
            rounded-lg border border-blue-100
            bg-white p-3 md:flex
          "
        >
          <Button
            disabled={page <= 1 || loading}
            onClick={handlePrevPage}
            icon={<LeftOutlined />}
          >
            Sebelumnya
          </Button>

          <span className="text-xs text-slate-500">
            Halaman {meta.page} / {Math.max(1, meta.totalPages)}
          </span>

          <Button
            type="primary"
            disabled={page >= meta.totalPages || loading}
            onClick={handleNextPage}
          >
            Berikutnya <RightOutlined />
          </Button>
        </div>
      </div>

      <nav
        aria-label="Navigasi price list"
        className="
          fixed inset-x-0 bottom-0 z-30
          border-t border-blue-100 bg-white
          pb-[env(safe-area-inset-bottom)]
          shadow-[0_-4px_20px_rgba(15,23,42,0.06)]
          md:hidden
        "
      >
        <div
          className="
            mx-auto grid max-w-lg grid-cols-4
            gap-1 px-2 py-1.5
          "
        >
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={handlePrevPage}
            className="
              flex min-h-12 flex-col items-center
              justify-center gap-1 rounded-lg
              text-[10px] font-medium text-slate-600
              disabled:opacity-35
            "
          >
            <LeftOutlined className="text-lg" />
            <span>Sebelumnya</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="
              flex min-h-12 flex-col items-center
              justify-center gap-1 rounded-lg
              bg-blue-50 text-[10px]
              font-medium text-blue-600
            "
          >
            <FilterOutlined className="text-lg" />
            <span>Filter{categoryId ? " · 1" : ""}</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => {
              void fetchPriceList();
            }}
            className="
              flex min-h-12 flex-col items-center
              justify-center gap-1 rounded-lg
              text-[10px] font-medium text-slate-600
              disabled:opacity-35
            "
          >
            <ReloadOutlined spin={loading} className="text-lg" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            disabled={page >= meta.totalPages || loading}
            onClick={handleNextPage}
            className="
              flex min-h-12 flex-col items-center
              justify-center gap-1 rounded-lg
              text-[10px] font-medium text-blue-600
              disabled:opacity-35
            "
          >
            <RightOutlined className="text-lg" />
            <span>Berikutnya</span>
          </button>
        </div>
      </nav>

      <Drawer
        title="Filter produk"
        placement="bottom"
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        size={300}
      >
        <div
          className="
            mx-auto max-w-lg space-y-4
            pb-[env(safe-area-inset-bottom)]
          "
        >
          <div>
            <div className="mb-2 text-sm font-medium">Kategori</div>

            {categorySelect}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="large"
              disabled={loading}
              onClick={() => {
                handleReset();
                setFilterOpen(false);
              }}
            >
              Reset
            </Button>

            <Button
              size="large"
              type="primary"
              loading={loading}
              onClick={() => {
                handleSearch();
                setFilterOpen(false);
              }}
            >
              Terapkan
            </Button>
          </div>
        </div>
      </Drawer>
    </main>
  );
}
