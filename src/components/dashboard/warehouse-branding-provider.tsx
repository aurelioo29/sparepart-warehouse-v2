"use client";

import { createContext, useContext, type ReactNode } from "react";

const WarehouseSiteNameContext = createContext<string | null>(null);

type WarehouseBrandingProviderProps = {
  siteName: string;
  children: ReactNode;
};

export default function WarehouseBrandingProvider({
  siteName,
  children,
}: WarehouseBrandingProviderProps) {
  return (
    <WarehouseSiteNameContext.Provider value={siteName}>
      {children}
    </WarehouseSiteNameContext.Provider>
  );
}

export function useWarehouseSiteName() {
  const siteName = useContext(WarehouseSiteNameContext);

  if (siteName === null) {
    throw new Error(
      "useWarehouseSiteName must be used inside WarehouseBrandingProvider.",
    );
  }

  return siteName;
}
