"use client";

import { Zap } from "lucide-react";
import { useState } from "react";
import { AutoDialerForm } from "./AutoDialerForm";
import { Modal } from "./ui/Modal";
import type { DialerSettingsDto } from "@/lib/dialer";

type Props = {
  segment: "LEADS" | "COD" | "NDR";
  settings: DialerSettingsDto | null;
  activeCalls: number;
  lastResult: string | null;
  loadError?: string | null;
  saving: boolean;
  onSave: (partial: Partial<DialerSettingsDto>) => void;
};

export function AutomateButton({
  segment,
  settings,
  activeCalls,
  lastResult,
  loadError,
  saving,
  onSave,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [hover, setHover] = useState(false);

  const enabled = settings?.enabled ?? false;
  const filterSummary = settings ? buildFilterSummary(segment, settings.filters) : [];

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition-colors ${
            enabled
              ? "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              enabled ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
            }`}
          />
          <Zap className="h-4 w-4" />
          Automate
          <span className="text-xs font-normal text-slate-500">
            {enabled ? "On" : "Off"}
          </span>
        </button>

        {hover && settings && (
          <div
            className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
            role="tooltip"
          >
            <p className="text-xs font-semibold text-slate-900">
              Auto dialer · {enabled ? "Active" : "Inactive"}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              <li className="flex justify-between">
                <span>Parallel / batch</span>
                <span className="font-medium text-slate-800">
                  {settings.batchSize}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Between batches</span>
                <span className="font-medium text-slate-800">
                  {Math.round(settings.delayBetweenBatchesMs / 1000)}s
                </span>
              </li>
              <li className="flex justify-between">
                <span>Between calls</span>
                <span className="font-medium text-slate-800">
                  {Math.round(settings.delayBetweenCallsMs / 1000)}s
                </span>
              </li>
              <li className="flex justify-between border-t border-slate-100 pt-1">
                <span>Active now</span>
                <span className="font-medium text-slate-800">{activeCalls}</span>
              </li>
            </ul>
            {filterSummary.length > 0 && (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <p className="text-[11px] font-semibold text-slate-700">
                  Active filters
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {filterSummary.map((x) => (
                    <span
                      key={x}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700"
                    >
                      {x}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-2 text-[10px] text-slate-400">Click to edit settings</p>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Automate outbound calls"
        description="Batch size is parallel calls; delays control time between batches and between call starts"
        size="lg"
      >
        {loadError ? (
          <p className="text-sm text-rose-600">{loadError}</p>
        ) : settings ? (
          <AutoDialerForm
            settings={settings}
            activeCalls={activeCalls}
            lastResult={lastResult}
            saving={saving}
            segment={segment}
            onSave={onSave}
          />
        ) : (
          <p className="text-sm text-slate-500">Loading settings…</p>
        )}
      </Modal>
    </>
  );
}

function buildFilterSummary(
  segment: "LEADS" | "COD" | "NDR",
  filters: DialerSettingsDto["filters"] | undefined,
): string[] {
  if (!filters) return [];
  if (segment === "LEADS") {
    const f = filters.leads;
    if (!f) return [];
    return [
      f.score ? `score ${opLabel(f.score.op)} ${f.score.value}` : null,
      f.intent ? `intent ${eqLabel(f.intent.op)} ${f.intent.value}` : null,
      f.lastEvent
        ? `event ${inclusionLabel(f.lastEvent.op)} ${f.lastEvent.values.join(",")}`
        : null,
      f.date ? `last activity ${opLabel(f.date.op)} ${formatDate(f.date.value)}` : null,
    ].filter(Boolean) as string[];
  }

  if (segment === "COD") {
    const f = filters.cod;
    if (!f) return [];
    return [
      f.productPrice ? `price ${opLabel(f.productPrice.op)} ${f.productPrice.value}` : null,
      f.status ? `status ${eqLabel(f.status.op)} ${f.status.value}` : null,
      f.orderDate ? `order ${opLabel(f.orderDate.op)} ${formatDate(f.orderDate.value)}` : null,
      f.deliveryDate
        ? `delivery ${opLabel(f.deliveryDate.op)} ${formatDate(f.deliveryDate.value)}`
        : null,
    ].filter(Boolean) as string[];
  }

  const f = filters.ndr;
  if (!f) return [];
  return [
    f.cost ? `cost ${opLabel(f.cost.op)} ${f.cost.value}` : null,
    f.status ? `status ${eqLabel(f.status.op)} ${f.status.value}` : null,
    f.reasonStatus
      ? `reason ${eqLabel(f.reasonStatus.op)} ${f.reasonStatus.value}`
      : null,
    f.date ? `date ${opLabel(f.date.op)} ${formatDate(f.date.value)}` : null,
  ].filter(Boolean) as string[];
}

function opLabel(op: "gt" | "lt" | "eq") {
  if (op === "gt") return ">";
  if (op === "lt") return "<";
  return "=";
}

function eqLabel(op: "eq" | "neq") {
  return op === "eq" ? "=" : "!=";
}

function inclusionLabel(op: "in" | "not_in" | "eq") {
  if (op === "in") return "in";
  if (op === "not_in") return "not in";
  return "=";
}

function formatDate(input: string) {
  return input.slice(0, 10);
}
