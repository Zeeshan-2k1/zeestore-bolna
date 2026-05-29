"use client";

import { ShipmentNavigationProvider } from "@/contexts/shipment-navigation";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ShipmentNavigationProvider>{children}</ShipmentNavigationProvider>
  );
}
