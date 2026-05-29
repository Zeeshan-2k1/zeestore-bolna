"use client";

import { useCallback, useState } from "react";
import { AutomateButton } from "@/components/AutomateButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCodAutoDialer } from "@/hooks/useCodAutoDialer";
import { CodTab } from "./CodTab";

export function CodWorkspace() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const dialer = useCodAutoDialer(refresh);

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Step 2 · COD"
        title="COD confirmation"
        description="Pre-dispatch COD validation for unreachable customers, wrong addresses, and cancellation risk."
        actions={
          <AutomateButton
            segment="COD"
            settings={dialer.settings}
            activeCalls={dialer.activeCalls}
            lastResult={dialer.lastResult}
            loadError={dialer.loadError}
            saving={dialer.saving}
            onSave={dialer.save}
          />
        }
      />

      <CodTab refreshKey={refreshKey} onRefresh={refresh} />
    </div>
  );
}

