"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export default function DashboardHeader({
  user_name,
  actions,
}: {
  user_name: string;
  actions?: ReactNode;
}) {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-2 md:flex-nowrap">
      <div className="min-w-0">
        <p className="text-sm font-bold text-indigo-600">
          Live · {time.toLocaleTimeString()}
        </p>
        <h2 className="truncate text-2xl font-black tracking-tight text-slate-900 md:text-4xl">
          Welcome back, {user_name}{" "}
          <span className="animate-wave inline-block text-2xl" aria-hidden>
            👋
          </span>
        </h2>
      </div>
      {actions ? <div className="flex items-center gap-2 self-end">{actions}</div> : null}
    </header>
  );
}
