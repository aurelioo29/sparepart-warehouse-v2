import { Suspense } from "react";

import PublicRackScanClient from "./public-rack-scan-client";

export default function PublicRackScanPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 px-4 py-8">
          <div className="mx-auto max-w-xl">
            <div className="rounded-xl bg-white p-6 text-center shadow-sm">
              <div className="text-sm text-slate-500">Loading rack scan...</div>
            </div>
          </div>
        </main>
      }
    >
      <PublicRackScanClient />
    </Suspense>
  );
}
