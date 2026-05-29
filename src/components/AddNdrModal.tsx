"use client";

import { Download, Info, Plus, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { NdrReason, PaymentType } from "@/lib/constants";
import { CSV_TEMPLATE } from "@/lib/csv-import";
import { Modal } from "./ui/Modal";
import { FormSelect } from "./ui/FormSelect";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddNdrModal({ open, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<"manual" | "csv">("manual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function resetAndClose() {
    setError(null);
    setImportMessage(null);
    setTab("manual");
    onClose();
  }

  async function handleManualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());

    const res = await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create");
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess();
    resetAndClose();
  }

  async function handleCsv(file: File) {
    setLoading(true);
    setError(null);
    setImportMessage(null);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/shipments/import", { method: "POST", body: form });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Import failed");
      setLoading(false);
      return;
    }

    const errCount = data.errors?.length ?? 0;
    setImportMessage(
      `Imported ${data.imported} shipment(s)${errCount > 0 ? ` · ${errCount} errors` : ""}`,
    );
    setLoading(false);
    onSuccess();
    if (errCount === 0) {
      setTimeout(resetAndClose, 1200);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ndr-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Add NDR"
      description="Create a single entry or bulk import from CSV"
      size="lg"
    >
      <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`flex-1 rounded-md py-2 text-sm font-medium ${
            tab === "manual"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Manual entry
        </button>
        <button
          type="button"
          onClick={() => setTab("csv")}
          className={`flex-1 rounded-md py-2 text-sm font-medium ${
            tab === "csv"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Import CSV
        </button>
      </div>

      {tab === "manual" ? (
        <form onSubmit={handleManualSubmit} className="grid gap-3 sm:grid-cols-2">
          <input name="customerName" placeholder="Customer name" required className="input" />
          <input name="phone" placeholder="+919876543210" required className="input" />
          <input name="orderId" placeholder="ORD-12345" required className="input" />
          <input name="orderAmount" type="number" placeholder="Amount (INR)" required className="input" />
          <input name="productSummary" placeholder="Product" required className="input sm:col-span-2" />
          <input name="address" placeholder="Full address" required className="input sm:col-span-2" />
          <input name="addressShort" placeholder="Short address" required className="input sm:col-span-2" />
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Delivery attempt date & time
            </span>
            <input
              name="deliveryDate"
              type="datetime-local"
              required
              defaultValue={new Date().toISOString().slice(0, 16)}
              className="input"
            />
          </label>
          <FormSelect name="paymentType" defaultValue={PaymentType.COD}>
            <option value={PaymentType.COD}>COD</option>
            <option value={PaymentType.PREPAID}>Prepaid</option>
          </FormSelect>
          <FormSelect name="ndrReason" defaultValue={NdrReason.CUSTOMER_UNAVAILABLE}>
            <option value={NdrReason.CUSTOMER_UNAVAILABLE}>Customer unavailable</option>
            <option value={NdrReason.WRONG_ADDRESS}>Wrong address</option>
            <option value={NdrReason.COD_REFUSED}>COD refused</option>
            <option value={NdrReason.GATE_CLOSED}>Gate closed</option>
          </FormSelect>
          <FormSelect name="languagePref" className="sm:col-span-2" defaultValue="hi-en">
            <option value="hi-en">Hinglish</option>
            <option value="hi">Hindi</option>
            <option value="en">English</option>
          </FormSelect>
          {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:col-span-2"
          >
            <Plus className="h-4 w-4" />
            {loading ? "Creating…" : "Create NDR"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <p className="text-sm text-slate-600">
              Use our CSV template with required columns: orderId, customerName,
              phone, productSummary, orderAmount, address, addressShort.{" "}
              <button
                type="button"
                onClick={downloadTemplate}
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                Download template
              </button>
            </p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCsv(f);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            disabled={loading}
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-slate-600 transition-colors hover:border-sky-300 hover:bg-sky-50/50 hover:text-sky-800 disabled:opacity-50"
          >
            <Upload className="h-8 w-8 text-slate-400" />
            <span className="text-sm font-medium">
              {loading ? "Importing…" : "Click to upload CSV"}
            </span>
            <span className="text-xs text-slate-400">or drag and drop</span>
          </button>

          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Download template.csv
          </button>

          {importMessage && (
            <p className="text-sm text-emerald-700">{importMessage}</p>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

/** Trigger button for opening Add NDR modal */
export function AddNdrTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
    >
      <Plus className="h-4 w-4" />
      Add NDR
    </button>
  );
}
