"use client";

import { ChevronDown, PhoneCall } from "lucide-react";
import type { ReactNode } from "react";
import type { DialerSettingsDto } from "@/lib/dialer";
import {
  CodShipmentStatuses,
  LeadIntent,
  NdrShipmentStatuses,
  ShopifyEventName,
  ShipmentStatus,
} from "@/lib/constants";
import { DIALER_POLL_MS } from "@/lib/refresh-intervals";

function delayLabel(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec <= 0) return "0s";
  return `${sec}s`;
}

type Props = {
  settings: DialerSettingsDto;
  activeCalls: number;
  lastResult: string | null;
  saving: boolean;
  segment: "LEADS" | "COD" | "NDR";
  onSave: (partial: Partial<DialerSettingsDto>) => void;
};

export function AutoDialerForm({
  settings,
  activeCalls,
  lastResult,
  saving,
  segment,
  onSave,
}: Props) {
  const filters = settings.filters ?? {};
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Automation</p>
          <p className="text-xs text-slate-500">
            {settings.enabled ? "Running" : "Paused"} · {activeCalls} active call
            {activeCalls !== 1 ? "s" : ""}
          </p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={settings.enabled}
            disabled={saving}
            onChange={(e) => onSave({ enabled: e.target.checked })}
            className="peer sr-only"
          />
          <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-sky-500 peer-disabled:opacity-50" />
          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Parallel calls per batch"
          hint="Max calls in flight at once"
          value={settings.batchSize}
          min={1}
          max={20}
          onChange={(v) => onSave({ batchSize: v })}
        />
        <Field
          label="Delay between batches (sec)"
          hint="Wait after a batch finishes before the next one starts"
          value={Math.round(settings.delayBetweenBatchesMs / 1000)}
          min={0}
          max={600}
          onChange={(v) => onSave({ delayBetweenBatchesMs: v * 1000 })}
        />
        <Field
          label="Delay between calls in batch (sec)"
          hint="Stagger when starting each call in the same batch"
          value={Math.round(settings.delayBetweenCallsMs / 1000)}
          min={0}
          max={60}
          onChange={(v) => onSave({ delayBetweenCallsMs: v * 1000 })}
        />
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Automation filters</p>
            <p className="text-xs text-slate-500">
              Only matching records will be picked by the auto dialer.
            </p>
          </div>
          <button
            type="button"
            className="text-xs font-medium text-sky-700 hover:text-sky-800"
            onClick={() =>
              onSave({
                filters:
                  segment === "LEADS"
                    ? { ...filters, leads: {} }
                    : segment === "COD"
                      ? { ...filters, cod: {} }
                      : { ...filters, ndr: {} },
              })
            }
          >
            Reset filters
          </button>
        </div>
        {segment === "LEADS" ? (
          <LeadFilterBuilder
            value={filters.leads ?? {}}
            onChange={(leads) => onSave({ filters: { ...filters, leads } })}
          />
        ) : segment === "COD" ? (
          <CodFilterBuilder
            value={filters.cod ?? {}}
            onChange={(cod) => onSave({ filters: { ...filters, cod } })}
          />
        ) : (
          <NdrFilterBuilder
            value={filters.ndr ?? {}}
            onChange={(ndr) => onSave({ filters: { ...filters, ndr } })}
          />
        )}
      </div>

      {settings.enabled && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <PhoneCall className="h-3.5 w-3.5 shrink-0" />
          <span>
            Background worker · every {DIALER_POLL_MS / 1000}s · up to{" "}
            {settings.batchSize} parallel ·{" "}
            {delayLabel(settings.delayBetweenCallsMs)} between calls ·{" "}
            {delayLabel(settings.delayBetweenBatchesMs)} between batches
            <span className="block text-[11px] text-sky-600/90">
              Run <code className="rounded bg-sky-100 px-1">npm run dialer:worker</code>{" "}
              in a separate terminal (no browser required)
            </span>
          </span>
          {lastResult && (
            <span className="font-medium text-sky-700">· {lastResult}</span>
          )}
        </p>
      )}
    </div>
  );
}

function LeadFilterBuilder({
  value,
  onChange,
}: {
  value: NonNullable<DialerSettingsDto["filters"]>["leads"];
  onChange: (v: NonNullable<DialerSettingsDto["filters"]>["leads"]) => void;
}) {
  const current = value ?? {};
  const entries = [
    current.score ? "score" : null,
    current.intent ? "intent" : null,
    current.lastEvent ? "lastEvent" : null,
    current.date ? "date" : null,
  ].filter(Boolean) as Array<"score" | "intent" | "lastEvent" | "date">;
  const remaining = (["score", "intent", "lastEvent", "date"] as const).filter(
    (k) => !entries.includes(k),
  );

  return (
    <div className="space-y-3">
      {entries.map((key) => (
        <FilterRow
          key={key}
          label={leadLabel(key)}
          onRemove={() => {
            const next = { ...current };
            delete next[key];
            onChange(next);
          }}
        >
          {key === "score" && (
            <OpNumberField
              op={current.score?.op ?? "gt"}
              value={current.score?.value ?? 50}
              onChange={(op, n) => onChange({ ...current, score: { op, value: n } })}
            />
          )}
          {key === "intent" && (
            <OpStringField
              op={current.intent?.op ?? "eq"}
              value={current.intent?.value ?? LeadIntent.HOT}
              options={Object.values(LeadIntent)}
              onChange={(op, v) => onChange({ ...current, intent: { op, value: v } })}
            />
          )}
          {key === "lastEvent" && (
            <InclusionField
              op={current.lastEvent?.op ?? "in"}
              values={current.lastEvent?.values ?? [ShopifyEventName.ADD_TO_CART]}
              options={Object.values(ShopifyEventName)}
              onChange={(op, values) =>
                onChange({ ...current, lastEvent: { op, values } })
              }
            />
          )}
          {key === "date" && (
            <DateField
              op={current.date?.op ?? "gt"}
              value={current.date?.value ?? new Date().toISOString().slice(0, 10)}
              onChange={(op, value) => onChange({ ...current, date: { op, value } })}
            />
          )}
        </FilterRow>
      ))}

      <AddFilterMenu
        options={remaining.map((k) => ({ key: k, label: leadLabel(k) }))}
        onAdd={(key) => {
          if (key === "score") onChange({ ...current, score: { op: "gt", value: 50 } });
          if (key === "intent")
            onChange({ ...current, intent: { op: "eq", value: LeadIntent.HOT } });
          if (key === "lastEvent")
            onChange({
              ...current,
              lastEvent: { op: "in", values: [ShopifyEventName.ADD_TO_CART] },
            });
          if (key === "date")
            onChange({
              ...current,
              date: { op: "gt", value: new Date().toISOString().slice(0, 10) },
            });
        }}
      />
    </div>
  );
}

function CodFilterBuilder({
  value,
  onChange,
}: {
  value: NonNullable<DialerSettingsDto["filters"]>["cod"];
  onChange: (v: NonNullable<DialerSettingsDto["filters"]>["cod"]) => void;
}) {
  const current = value ?? {};
  const entries = [
    current.productPrice ? "productPrice" : null,
    current.status ? "status" : null,
    current.orderDate ? "orderDate" : null,
    current.deliveryDate ? "deliveryDate" : null,
  ].filter(Boolean) as Array<"productPrice" | "status" | "orderDate" | "deliveryDate">;

  const remaining = ([
    "productPrice",
    "status",
    "orderDate",
    "deliveryDate",
  ] as const).filter((k) => !entries.includes(k));

  return (
    <div className="space-y-3">
      {entries.map((key) => (
        <FilterRow
          key={key}
          label={codLabel(key)}
          onRemove={() => {
            const next = { ...current };
            delete next[key];
            onChange(next);
          }}
        >
          {key === "productPrice" && (
            <OpNumberField
              op={current.productPrice?.op ?? "gt"}
              value={current.productPrice?.value ?? 1000}
              onChange={(op, n) =>
                onChange({ ...current, productPrice: { op, value: n } })
              }
            />
          )}
          {key === "status" && (
            <OpStringField
              op={current.status?.op ?? "eq"}
              value={current.status?.value ?? ShipmentStatus.COD_PENDING}
              options={[...CodShipmentStatuses]}
              onChange={(op, v) => onChange({ ...current, status: { op, value: v } })}
            />
          )}
          {key === "orderDate" && (
            <DateField
              op={current.orderDate?.op ?? "gt"}
              value={current.orderDate?.value ?? new Date().toISOString().slice(0, 10)}
              onChange={(op, value) => onChange({ ...current, orderDate: { op, value } })}
            />
          )}
          {key === "deliveryDate" && (
            <DateField
              op={current.deliveryDate?.op ?? "gt"}
              value={current.deliveryDate?.value ?? new Date().toISOString().slice(0, 10)}
              onChange={(op, value) =>
                onChange({ ...current, deliveryDate: { op, value } })
              }
            />
          )}
        </FilterRow>
      ))}

      <AddFilterMenu
        options={remaining.map((k) => ({ key: k, label: codLabel(k) }))}
        onAdd={(key) => {
          if (key === "productPrice") {
            onChange({ ...current, productPrice: { op: "gt", value: 1000 } });
          }
          if (key === "status") {
            onChange({
              ...current,
              status: { op: "eq", value: ShipmentStatus.COD_PENDING },
            });
          }
          if (key === "orderDate") {
            onChange({
              ...current,
              orderDate: { op: "gt", value: new Date().toISOString().slice(0, 10) },
            });
          }
          if (key === "deliveryDate") {
            onChange({
              ...current,
              deliveryDate: { op: "gt", value: new Date().toISOString().slice(0, 10) },
            });
          }
        }}
      />
    </div>
  );
}

function NdrFilterBuilder({
  value,
  onChange,
}: {
  value: NonNullable<DialerSettingsDto["filters"]>["ndr"];
  onChange: (v: NonNullable<DialerSettingsDto["filters"]>["ndr"]) => void;
}) {
  const current = value ?? {};
  const entries = [
    current.cost ? "cost" : null,
    current.status ? "status" : null,
    current.reasonStatus ? "reasonStatus" : null,
    current.date ? "date" : null,
  ].filter(Boolean) as Array<"cost" | "status" | "reasonStatus" | "date">;
  const remaining = (["cost", "status", "reasonStatus", "date"] as const).filter(
    (k) => !entries.includes(k),
  );

  return (
    <div className="space-y-3">
      {entries.map((key) => (
        <FilterRow
          key={key}
          label={ndrLabel(key)}
          onRemove={() => {
            const next = { ...current };
            delete next[key];
            onChange(next);
          }}
        >
          {key === "cost" && (
            <OpNumberField
              op={current.cost?.op ?? "gt"}
              value={current.cost?.value ?? 1000}
              onChange={(op, n) => onChange({ ...current, cost: { op, value: n } })}
            />
          )}
          {key === "status" && (
            <OpStringField
              op={current.status?.op ?? "eq"}
              value={current.status?.value ?? ShipmentStatus.NDR_PENDING}
              options={[...NdrShipmentStatuses]}
              onChange={(op, v) => onChange({ ...current, status: { op, value: v } })}
            />
          )}
          {key === "reasonStatus" && (
            <OpStringField
              op={current.reasonStatus?.op ?? "eq"}
              value={current.reasonStatus?.value ?? "CUSTOMER_UNAVAILABLE"}
              options={["CUSTOMER_UNAVAILABLE", "WRONG_ADDRESS", "COD_REFUSED", "GATE_CLOSED", "OTHER"]}
              onChange={(op, v) =>
                onChange({ ...current, reasonStatus: { op, value: v } })
              }
            />
          )}
          {key === "date" && (
            <DateField
              op={current.date?.op ?? "gt"}
              value={current.date?.value ?? new Date().toISOString().slice(0, 10)}
              onChange={(op, value) => onChange({ ...current, date: { op, value } })}
            />
          )}
        </FilterRow>
      ))}

      <AddFilterMenu
        options={remaining.map((k) => ({ key: k, label: ndrLabel(k) }))}
        onAdd={(key) => {
          if (key === "cost") onChange({ ...current, cost: { op: "gt", value: 1000 } });
          if (key === "status")
            onChange({
              ...current,
              status: { op: "eq", value: ShipmentStatus.NDR_PENDING },
            });
          if (key === "reasonStatus")
            onChange({
              ...current,
              reasonStatus: { op: "eq", value: "CUSTOMER_UNAVAILABLE" },
            });
          if (key === "date")
            onChange({
              ...current,
              date: { op: "gt", value: new Date().toISOString().slice(0, 10) },
            });
        }}
      />
    </div>
  );
}

function OpNumberField({
  op,
  value,
  onChange,
}: {
  op: "gt" | "lt" | "eq";
  value: number;
  onChange: (op: "gt" | "lt" | "eq", value: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <SelectWithChevron
        value={op}
        onChange={(e) => onChange(e.target.value as "gt" | "lt" | "eq", value)}
      >
        <option value="gt">{">"}</option>
        <option value="lt">{"<"}</option>
        <option value="eq">{"="}</option>
      </SelectWithChevron>
      <input
        className="input col-span-2 w-full"
        type="number"
        value={value}
        onChange={(e) => onChange(op, Number(e.target.value || "0"))}
      />
    </div>
  );
}

function OpStringField({
  op,
  value,
  options,
  onChange,
}: {
  op: "eq" | "neq";
  value: string;
  options: string[];
  onChange: (op: "eq" | "neq", value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <SelectWithChevron
        value={op}
        onChange={(e) => onChange(e.target.value as "eq" | "neq", value)}
      >
        <option value="eq">=</option>
        <option value="neq">!=</option>
      </SelectWithChevron>
      <SelectWithChevron
        className="col-span-2"
        value={value}
        onChange={(e) => onChange(op, e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </SelectWithChevron>
    </div>
  );
}

function InclusionField({
  op,
  values,
  options,
  onChange,
}: {
  op: "in" | "not_in" | "eq";
  values: string[];
  options: string[];
  onChange: (op: "in" | "not_in" | "eq", values: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <SelectWithChevron
        value={op}
        onChange={(e) => onChange(e.target.value as "in" | "not_in" | "eq", values)}
      >
        <option value="in">in</option>
        <option value="not_in">not in</option>
        <option value="eq">=</option>
      </SelectWithChevron>
      <SelectWithChevron
        className="col-span-2"
        value={values[0] ?? options[0]}
        onChange={(e) => onChange(op, [e.target.value])}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </SelectWithChevron>
    </div>
  );
}

function DateField({
  op,
  value,
  onChange,
}: {
  op: "gt" | "lt";
  value: string;
  onChange: (op: "gt" | "lt", value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <SelectWithChevron
        value={op}
        onChange={(e) => onChange(e.target.value as "gt" | "lt", value)}
      >
        <option value="gt">{">"}</option>
        <option value="lt">{"<"}</option>
      </SelectWithChevron>
      <input
        className="input col-span-2 w-full"
        type="date"
        value={value.slice(0, 10)}
        onChange={(e) => onChange(op, e.target.value)}
      />
    </div>
  );
}

function SelectWithChevron({
  className,
  value,
  onChange,
  children,
}: {
  className?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <select
        className="input w-full appearance-none pr-9"
        value={value}
        onChange={onChange}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

function FilterRow({
  label,
  onRemove,
  children,
}: {
  label: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        <button
          type="button"
          className="text-xs text-rose-600 hover:text-rose-700"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
      {children}
    </div>
  );
}

function AddFilterMenu<T extends string>({
  options,
  onAdd,
}: {
  options: Array<{ key: T; label: string }>;
  onAdd: (key: T) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">Add filter:</span>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          onClick={() => onAdd(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function leadLabel(key: "score" | "intent" | "lastEvent" | "date") {
  if (key === "score") return "Score";
  if (key === "intent") return "Intent";
  if (key === "lastEvent") return "Last event";
  return "Last activity date";
}

function ndrLabel(key: "cost" | "status" | "reasonStatus" | "date") {
  if (key === "cost") return "Cost (order amount)";
  if (key === "status") return "Status";
  if (key === "reasonStatus") return "Reason status";
  return "Shipment date";
}

function codLabel(
  key: "productPrice" | "status" | "orderDate" | "deliveryDate",
) {
  if (key === "productPrice") return "Product price";
  if (key === "status") return "Status";
  if (key === "orderDate") return "Order date";
  return "Delivery date";
}

function Field({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block sm:col-span-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="input mt-1"
      />
    </label>
  );
}
