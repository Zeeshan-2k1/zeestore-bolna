"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AutomateButton } from "@/components/AutomateButton";
import { useLeadAutoDialer } from "@/hooks/useLeadAutoDialer";
import { LeadsTab } from "./LeadsTab";

export function LeadWorkspace() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const dialer = useLeadAutoDialer(refresh);

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Step 1 · Leads"
        title="Lead conversion"
        description="Capture Shopify events, score intent, and automate outbound conversion calls."
        actions={
          <AutomateButton
            segment="LEADS"
            settings={dialer.settings}
            activeCalls={dialer.activeCalls}
            lastResult={dialer.lastResult}
            loadError={dialer.loadError}
            saving={dialer.saving}
            onSave={dialer.save}
          />
        }
      />

      <LeadsTab refreshKey={refreshKey} onRefresh={refresh} />
    </div>
  );
}

