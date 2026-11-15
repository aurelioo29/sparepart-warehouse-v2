"use client";

import { useEffect, useState } from "react";
import { Alert, Card, Spin, Tag } from "antd";
import { useSearchParams } from "next/navigation";

type RackScanData = {
  id: string;
  name: string;
  code: string;
  barcodeValue?: string | null;
  description?: string | null;
  warehouse: {
    id: string;
    name: string;
    code: string;
  };
};

export default function PublicRackScanClient() {
  const searchParams = useSearchParams();
  const barcode = searchParams.get("barcode") || "";

  const [loading, setLoading] = useState(true);
  const [rackLocation, setRackLocation] = useState<RackScanData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function fetchRackLocation() {
      try {
        setLoading(true);
        setErrorMessage("");
        setRackLocation(null);

        if (!barcode) {
          setErrorMessage("Barcode tidak ditemukan di URL.");
          return;
        }

        const response = await fetch(
          `/api/public/rack-locations/scan?barcode=${encodeURIComponent(
            barcode,
          )}`,
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Rack location tidak ditemukan");
        }

        setRackLocation(result.data);
      } catch (error) {
        console.error(error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Gagal membaca rack location",
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchRackLocation();
  }, [barcode]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Rack Location Scan
          </div>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Warehouse Rack Info
          </h1>
        </div>

        {loading ? (
          <div className="flex justify-center rounded-xl bg-white py-16 shadow-sm">
            <Spin />
          </div>
        ) : errorMessage ? (
          <Alert
            type="error"
            showIcon
            title="Error"
            description={errorMessage}
          />
        ) : rackLocation ? (
          <Card>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-slate-500">Rack Name</div>
                <div className="text-xl font-bold text-slate-900">
                  {rackLocation.name}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-500">Rack Code</div>
                <Tag color="blue">{rackLocation.code}</Tag>
              </div>

              <div>
                <div className="text-sm text-slate-500">Warehouse</div>
                <div className="font-semibold text-slate-800">
                  {rackLocation.warehouse.name}
                </div>
                <div className="text-sm text-slate-500">
                  {rackLocation.warehouse.code}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-500">Barcode Value</div>
                <div className="break-all rounded bg-slate-100 p-2 font-mono text-xs text-slate-700">
                  {rackLocation.barcodeValue || "-"}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-500">Description</div>
                <div className="text-slate-700">
                  {rackLocation.description || "-"}
                </div>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
