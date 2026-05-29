const STATUS_STYLES: Record<string, string> = {
  NDR_PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  CALL_IN_PROGRESS: "bg-sky-50 text-sky-800 border-sky-200",
  REATTEMPT_CONFIRMED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  RTO_CONFIRMED: "bg-rose-50 text-rose-800 border-rose-200",
  RESCHEDULED: "bg-violet-50 text-violet-800 border-violet-200",
  ADDRESS_UPDATED: "bg-cyan-50 text-cyan-800 border-cyan-200",
  NEED_HUMAN: "bg-orange-50 text-orange-800 border-orange-200",
  NO_ANSWER: "bg-slate-100 text-slate-600 border-slate-200",
  HOT: "bg-rose-50 text-rose-800 border-rose-200",
  WARM: "bg-amber-50 text-amber-800 border-amber-200",
  COLD: "bg-cyan-50 text-cyan-800 border-cyan-200",
};

export function StatusBadge({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
