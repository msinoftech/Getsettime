"use client";

import { useEffect, useState } from "react";

export default function DashboardHeader({ user_name }: { user_name: string }) {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="flex flex-wrap items-start justify-between gap-4 pb-2">
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
    </header>
  );
}
