"use client";

import type { ReactNode } from "react";

export default function   DashboardHeader({
  user_name,
  subtitle,
  actions,
}: {
  user_name: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between max-[450px]:gap-2 gap-4 md:flex-nowrap">
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Welcome back, {user_name}{" "}
          <span className="animate-wave inline-block" aria-hidden>
            👋
          </span>
        </h2>
        {subtitle ? (
          <p className="text-sm text-slate-600">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2.5 flex-wrap">{actions}</div> : null}
    </header>
  );
}
