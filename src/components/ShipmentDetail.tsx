"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { useShipmentNavigation } from "@/contexts/shipment-navigation";
import { StatusBadge } from "./StatusBadge";
import { IconButton } from "./ui/IconButton";
import {
  formatDate,
  formatDateTime,
  formatFailureCode,
  formatInr,
  formatNdrReason,
  formatTime,
  formatTriggerSource,
} from "@/lib/format";

type Call = {
  id: string;
  status: string;
  triggerSource: string;
  failureCode: string | null;
  outcome: string | null;
  reason: string | null;
  selectedSlotId: string | null;
  addressUpdate: string | null;
  sentiment: string | null;
  languageUsed: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  durationSec: number | null;
  costInr: number | null;
  createdAt: string;
};

type Shipment = {
  id: string;
  awb: string;
  orderId: string;
  customerName: string;
  phone: string;
  productSummary: string;
  orderAmount: number;
  paymentType: string;
  address: string;
  addressShort: string;
  secondaryAddress?: string | null;
  secondaryPhone?: string | null;
  ndrReason: string;
  status: string;
  languagePref: string;
  incentiveText: string | null;
  deliveryDate: string;
  createdAt: string;
  resolvedAt: string | null;
  calls: Call[];
};

export function ShipmentDetail({ id }: { id: string }) {
  const { clearViewing } = useShipmentNavigation();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/shipments/${id}`);
    const data = await res.json();
    setShipment(data.shipment ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      const res = await fetch(`/api/shipments/${id}`);
      const data = await res.json();
      if (cancelled) return;
      setShipment(data.shipment ?? null);
      setLoading(false);
      clearViewing();
    }

    initialLoad();
    const interval = setInterval(load, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearViewing();
    };
  }, [id, load, clearViewing]);

  async function triggerCall() {
    setCalling(true);
    setError(null);
    const res = await fetch(`/api/shipments/${id}/trigger-call`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Call failed");
      await load();
      return;
    }
    setCalling(false);
    await load();
  }

  async function simulate() {
    await fetch(`/api/shipments/${id}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: "REATTEMPT_CONFIRMED", selectedSlotId: "S1" }),
    });
    await load();
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!shipment) return <p className="text-rose-600">Shipment not found</p>;

  const canCall =
    shipment.status === "NDR_PENDING" ||
    shipment.status === "NO_ANSWER" ||
    shipment.status === "RESCHEDULED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-slate-400">{shipment.awb}</p>
          <h1 className="text-2xl font-bold text-slate-900">{shipment.orderId}</h1>
          <p className="mt-1 text-slate-600">
            {shipment.customerName} · {shipment.phone}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={shipment.status} />
          {canCall && (
            <>
              <IconButton
                icon={<Phone className="h-4 w-4" />}
                label="Resolve via voice"
                variant="primary"
                disabled={calling}
                onClick={triggerCall}
              />
              <button
                type="button"
                onClick={simulate}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
              >
                Simulate
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">Shipment</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Product" value={shipment.productSummary} />
            <Row label="Amount" value={formatInr(shipment.orderAmount)} />
            <Row label="Payment" value={shipment.paymentType} />
            <Row label="NDR reason" value={formatNdrReason(shipment.ndrReason)} />
            <Row label="Address" value={shipment.address} />
            {shipment.secondaryAddress && (
              <Row label="Secondary address" value={shipment.secondaryAddress} />
            )}
            {shipment.secondaryPhone && (
              <Row label="Alt. phone" value={shipment.secondaryPhone} />
            )}
            <Row label="Language" value={shipment.languagePref} />
            {shipment.incentiveText && (
              <Row label="Incentive" value={shipment.incentiveText} />
            )}
            <Row label="Delivery">
              <dd className="text-slate-800">
                <p>{formatDate(shipment.deliveryDate)}</p>
                <p className="text-xs text-slate-500">
                  {formatTime(shipment.deliveryDate)}
                </p>
              </dd>
            </Row>
            <Row label="Created" value={formatDateTime(shipment.createdAt)} />
            {shipment.resolvedAt && (
              <Row label="Resolved" value={formatDateTime(shipment.resolvedAt)} />
            )}
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">Call history</h2>
          {shipment.calls.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No calls yet</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {shipment.calls.map((call) => (
                <li
                  key={call.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500">{call.status}</span>
                    <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {formatTriggerSource(call.triggerSource)}
                    </span>
                    {call.outcome && <StatusBadge status={call.outcome} />}
                  </div>
                  {call.failureCode && (
                    <p className="mt-2 text-sm font-medium text-rose-700">
                      {formatFailureCode(call.failureCode)}
                    </p>
                  )}
                  {call.reason && (
                    <p className="mt-2 text-slate-700">{call.reason}</p>
                  )}
                  {call.addressUpdate && (
                    <p className="mt-2 text-slate-600">
                      Address update: {call.addressUpdate}
                    </p>
                  )}
                  {call.transcript && (
                    <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 whitespace-pre-wrap">
                      {call.transcript}
                    </pre>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    {formatDateTime(call.createdAt)}
                    {call.durationSec != null && ` · ${call.durationSec}s`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800">{children ?? value}</dd>
    </div>
  );
}
