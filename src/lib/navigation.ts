import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Phone,
  ShoppingBag,
  Users,
} from "lucide-react";
import { OpsSegment, type OpsSegmentValue } from "./constants";

export type NavItem = {
  id: OpsSegmentValue | "dashboard";
  label: string;
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** Order in the D2C pipeline (dashboard excluded) */
  pipelineOrder?: number;
};

export const DASHBOARD_NAV: NavItem = {
  id: "dashboard",
  label: "Dashboard",
  shortLabel: "Home",
  href: "/",
  icon: LayoutDashboard,
  description: "Cross-segment call analytics and ops overview",
};

export const PIPELINE_NAV = [
  {
    id: OpsSegment.LEADS,
    label: "Leads",
    shortLabel: "Leads",
    href: "/leads",
    icon: Users,
    description: "Convert potential customers with outbound voice",
    pipelineOrder: 1,
  },
  {
    id: OpsSegment.COD,
    label: "COD confirmation",
    shortLabel: "COD",
    href: "/cod",
    icon: ShoppingBag,
    description: "Confirm cash-on-delivery orders before dispatch",
    pipelineOrder: 2,
  },
  {
    id: OpsSegment.NDR,
    label: "NDR resolution",
    shortLabel: "NDR",
    href: "/ndr",
    icon: Package,
    description: "Failed delivery recovery and reattempt scheduling",
    pipelineOrder: 3,
  },
] as const satisfies readonly NavItem[];

export const ALL_NAV: NavItem[] = [DASHBOARD_NAV, ...PIPELINE_NAV];

export function getNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/") return DASHBOARD_NAV;
  return PIPELINE_NAV.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

export function segmentLabel(segment: OpsSegmentValue): string {
  return PIPELINE_NAV.find((n) => n.id === segment)?.label ?? segment;
}

/** Placeholder roadmap bullets per segment (UI only for now). */
export const SEGMENT_ROADMAP: Record<OpsSegmentValue, string[]> = {
  [OpsSegment.LEADS]: [
    "Lead list with source, score, and product interest",
    "Bolna scripts for qualification and conversion",
    "Outcome tracking: converted, callback, not interested",
    "CRM-style filters and auto-dialer batches",
  ],
  [OpsSegment.COD]: [
    "Pre-dispatch COD order queue",
    "Voice confirmation: accept, reschedule, cancel",
    "Reduce RTO before shipment leaves FC",
    "Hand off confirmed orders to fulfillment",
  ],
  [OpsSegment.NDR]: [
    "NDR queue with filters and bulk import",
    "Reattempt, RTO, and address-update outcomes",
    "Auto-dialer with batch and delay controls",
    "Call analytics and API failure tracking",
  ],
};

export const SEGMENT_ACCENT: Record<
  OpsSegmentValue | "dashboard",
  { bg: string; text: string; ring: string; badge: string }
> = {
  dashboard: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    ring: "ring-sky-200",
    badge: "bg-sky-100 text-sky-800",
  },
  [OpsSegment.LEADS]: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    ring: "ring-violet-200",
    badge: "bg-violet-100 text-violet-800",
  },
  [OpsSegment.COD]: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    ring: "ring-emerald-200",
    badge: "bg-emerald-100 text-emerald-900",
  },
  [OpsSegment.NDR]: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    ring: "ring-rose-200",
    badge: "bg-rose-100 text-rose-800",
  },
};
