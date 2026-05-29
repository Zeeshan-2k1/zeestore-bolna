"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone } from "lucide-react";
import { DASHBOARD_NAV, PIPELINE_NAV, type NavItem } from "@/lib/navigation";
import { OpsSegment } from "@/lib/constants";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-sky-50 text-sky-900"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          active
            ? "bg-sky-500 text-white"
            : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-700"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.label}</span>
        {item.pipelineOrder != null && (
          <span className="block truncate text-[11px] font-normal text-slate-400">
            Step {item.pipelineOrder}
          </span>
        )}
      </span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    if (item.href === "/") return pathname === "/";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const activeSegment = PIPELINE_NAV.find((item) => isActive(item))?.id;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-white">
            <Phone className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              VoiceOps
            </p>
            <p className="truncate text-[11px] text-slate-500">
              D2C · lead to NDR
            </p>
          </div>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden px-3 py-4">
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Overview
          </p>
          <NavLink item={DASHBOARD_NAV} active={isActive(DASHBOARD_NAV)} />
        </div>

        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Voice ops pipeline
          </p>
          <ul className="space-y-0.5">
            {PIPELINE_NAV.map((item) => (
              <li key={item.id}>
                <NavLink item={item} active={isActive(item)} />
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Pipeline
          </p>
          <ol className="mt-2 space-y-1.5">
            {PIPELINE_NAV.map((item) => {
              const done =
                activeSegment &&
                PIPELINE_NAV.findIndex((n) => n.id === activeSegment) >=
                  (item.pipelineOrder ?? 0) - 1;
              return (
                <li
                  key={item.id}
                  className={`flex items-center gap-2 text-xs ${
                    isActive(item)
                      ? "font-medium text-sky-700"
                      : done
                        ? "text-slate-600"
                        : "text-slate-400"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      isActive(item)
                        ? "bg-sky-500"
                        : item.id === OpsSegment.NDR && pathname.startsWith("/ndr")
                          ? "bg-sky-400"
                          : "bg-slate-300"
                    }`}
                  />
                  {item.shortLabel}
                </li>
              );
            })}
          </ol>
        </div>
      </nav>

      <div className="border-t border-slate-100 px-4 py-3">
        <p className="text-[10px] text-slate-400">
          Powered by{" "}
          <span className="font-medium text-slate-600">Bolna Voice AI</span>
        </p>
      </div>
    </aside>
  );
}
