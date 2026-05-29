"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ContextValue = {
  viewingShipmentId: string | null;
  navigateToShipment: (id: string) => void;
  clearViewing: () => void;
};

const ShipmentNavigationContext = createContext<ContextValue | null>(null);

export function ShipmentNavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [viewingShipmentId, setViewingShipmentId] = useState<string | null>(
    null,
  );

  const navigateToShipment = useCallback(
    (id: string) => {
      setViewingShipmentId(id);
      router.push(`/shipments/${id}`);
    },
    [router],
  );

  const clearViewing = useCallback(() => {
    setViewingShipmentId(null);
  }, []);

  const value = useMemo(
    () => ({ viewingShipmentId, navigateToShipment, clearViewing }),
    [viewingShipmentId, navigateToShipment, clearViewing],
  );

  return (
    <ShipmentNavigationContext.Provider value={value}>
      {children}
    </ShipmentNavigationContext.Provider>
  );
}

export function useShipmentNavigation() {
  const ctx = useContext(ShipmentNavigationContext);
  if (!ctx) {
    throw new Error("useShipmentNavigation must be used within provider");
  }
  return ctx;
}
