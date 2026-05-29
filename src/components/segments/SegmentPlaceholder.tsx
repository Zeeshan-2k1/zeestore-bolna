import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import type { OpsSegmentValue } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  PIPELINE_NAV,
  SEGMENT_ACCENT,
  SEGMENT_ROADMAP,
  segmentLabel,
} from "@/lib/navigation";

type Props = {
  segment: OpsSegmentValue;
};

export function SegmentPlaceholder({ segment }: Props) {
  const nav = PIPELINE_NAV.find((n) => n.id === segment)!;
  const accent = SEGMENT_ACCENT[segment];
  const roadmap = SEGMENT_ROADMAP[segment];
  const prev = PIPELINE_NAV.find((n) => n.pipelineOrder === (nav.pipelineOrder ?? 0) - 1);
  const next = PIPELINE_NAV.find((n) => n.pipelineOrder === (nav.pipelineOrder ?? 0) + 1);

  return (
    <div className="space-y-8">
      <PageHeader
        badge={`Step ${nav.pipelineOrder} · Voice ops`}
        title={nav.label}
        description={nav.description}
        actions={
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${accent.badge}`}
          >
            <Phone className="h-3.5 w-3.5" />
            Bolna outbound
          </span>
        }
      />

      <div className={`card border-2 border-dashed p-8 ${accent.ring} ring-1 ring-inset`}>
        <div className="mx-auto max-w-xl text-center">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accent.badge}`}
          >
            Coming next
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            {segmentLabel(segment)} workspace
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            This section will host queues, call scripts, and automation for{" "}
            {nav.description.toLowerCase()}. We are building the platform shell
            first — then each pipeline stage one by one.
          </p>
        </div>

        <ul className="mx-auto mt-8 max-w-md space-y-3">
          {roadmap.map((item) => (
            <li
              key={item}
              className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
            >
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent.bg}`}
              />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {prev && (
            <Link
              href={prev.href}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              ← {prev.shortLabel}
            </Link>
          )}
          {next && (
            <Link
              href={next.href}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              {next.shortLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
