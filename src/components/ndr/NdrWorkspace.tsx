"use client";

import { useCallback, useState } from "react";
import { AddNdrModal, AddNdrTrigger } from "@/components/AddNdrModal";
import { AutomateButton } from "@/components/AutomateButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { QueueTab } from "@/components/QueueTab";
import { useAutoDialer } from "@/hooks/useAutoDialer";

export function NdrWorkspace() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);

  const refreshQueue = useCallback(() => {
    setQueueRefreshKey((k) => k + 1);
  }, []);

  const dialer = useAutoDialer(refreshQueue);

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Step 3 · NDR"
        title="NDR resolution"
        description="Failed last-mile deliveries — voice AI for reattempt, RTO, and address fixes."
        actions={
          <>
            <AutomateButton
              segment="NDR"
              settings={dialer.settings}
              activeCalls={dialer.activeCalls}
              lastResult={dialer.lastResult}
              loadError={dialer.loadError}
              saving={dialer.saving}
              onSave={dialer.save}
            />
            <AddNdrTrigger onClick={() => setAddModalOpen(true)} />
          </>
        }
      />

      <QueueTab refreshKey={queueRefreshKey} onRefresh={refreshQueue} />

      <AddNdrModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={refreshQueue}
      />
    </div>
  );
}
