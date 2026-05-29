"use client";

import { AppSidebar } from "./AppSidebar";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-slate-50">
      <AppSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
