import { CALL_FAILURE_LABELS, NDR_REASON_LABELS, OpsSegment } from "./constants";
import { segmentLabel } from "./navigation";

export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise);
}

export function formatNdrReason(reason: string): string {
  return NDR_REASON_LABELS[reason] ?? reason;
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export function formatFailureCode(code: string): string {
  return CALL_FAILURE_LABELS[code] ?? code.replace(/_/g, " ");
}

export function formatTriggerSource(source: string): string {
  return source === "AUTOMATIC" ? "Automatic" : "Manual";
}

export function formatSegment(segment: string | null | undefined): string {
  const s = segment?.trim() || OpsSegment.NDR;
  if (s === OpsSegment.LEADS) return segmentLabel(OpsSegment.LEADS);
  if (s === OpsSegment.COD) return "COD";
  if (s === OpsSegment.NDR) return segmentLabel(OpsSegment.NDR);
  return s.replace(/_/g, " ");
}
