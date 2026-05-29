"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { OpsSegment, type OpsSegmentValue } from "@/lib/constants";
import {
  PIPELINE_NAV,
  SEGMENT_ACCENT,
  type NavItem,
} from "@/lib/navigation";

/** Placeholder KPIs until each segment is wired. */
const PLACEHOLDER_STATS: Record<
  OpsSegmentValue,
  { queue: string; calls: string; conversion: string }
> = {
  [OpsSegment.LEADS]: {
    queue: "Live",
    calls: "Live",
    conversion: "Live",
  },
  [OpsSegment.COD]: {
    queue: "Live",
    calls: "Live",
    conversion: "Live",
  },
  [OpsSegment.NDR]: {
    queue: "Live",
    calls: "Live",
    conversion: "Live",
  },
};

function SegmentCard({ item }: { item: NavItem }) {
  const accent = SEGMENT_ACCENT[item.id as OpsSegmentValue];
  const stats = PLACEHOLDER_STATS[item.id as OpsSegmentValue];
  const isLive =
    item.id === OpsSegment.NDR ||
    item.id === OpsSegment.LEADS ||
    item.id === OpsSegment.COD;

  return (
    <Link
      href={item.href}
      className={`card group block p-5 transition-shadow hover:shadow-md ring-1 ${accent.ring} ring-inset`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${accent.badge}`}
          >
            Step {item.pipelineOrder}
          </span>
          <h3 className="mt-2 text-base font-semibold text-slate-900">
            {item.label}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {item.description}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
        <div>
          <dt className="text-[10px] uppercase text-slate-400">Queue</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-800">
            {stats.queue}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-slate-400">Calls</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-800">
            {stats.calls}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-slate-400">Success</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-800">
            {stats.conversion}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-[11px] font-medium text-slate-500">
        {isLive ? (
          <span className="text-emerald-600">Active · open workspace</span>
        ) : (
          <span>Coming soon</span>
        )}
      </p>
    </Link>
  );
}

type Props = {
  highlightSegment?: OpsSegmentValue | "ALL";
};

export function SegmentOverviewCards({ highlightSegment = "ALL" }: Props) {
  const items =
    highlightSegment === "ALL"
      ? PIPELINE_NAV
      : PIPELINE_NAV.filter((n) => n.id === highlightSegment);

  return (
    <div
      className={`grid gap-4 ${
        items.length === 1 ? "sm:grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3"
      }`}
    >
      {items.map((item) => (
        <SegmentCard key={item.id} item={item} />
      ))}
    </div>
  );
}
