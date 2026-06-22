"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/src/providers/AuthProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { TIMEZONE_OPTIONS } from "@/src/constants/timezone";
import { MANAGE_ROLES } from "@/src/constants/roles";

const VISITOR_VALUE = "";

function tz_abbreviation(tz: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? null;
  } catch {
    return null;
  }
}

function GlobeIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-slate-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export default function DashboardTimezoneSelect() {
  const { user } = useAuth();
  const { general, settings, refetch } = useWorkspaceSettings();

  const [open, set_open] = useState(false);
  const [saving, set_saving] = useState(false);
  const [pending, set_pending] = useState<string | null>(null);
  const root_ref = useRef<HTMLDivElement>(null);

  const role = (user?.user_metadata?.role as string | undefined) ?? "";
  const can_edit = MANAGE_ROLES.includes(role);

  const current_tz = (general?.timezone ?? settings.general?.timezone ?? "").trim();
  const effective_tz = pending !== null ? pending : current_tz;

  const label = useMemo(() => {
    if (!effective_tz) return "Visitor's timezone";
    const abbr = tz_abbreviation(effective_tz);
    return abbr ? `${effective_tz} (${abbr})` : effective_tz;
  }, [effective_tz]);

  useEffect(() => {
    if (pending !== null && current_tz === pending) {
      set_pending(null);
    }
  }, [current_tz, pending]);

  useEffect(() => {
    if (!open) return;
    const on_pointer_down = (event: MouseEvent) => {
      if (!root_ref.current?.contains(event.target as Node)) {
        set_open(false);
      }
    };
    document.addEventListener("mousedown", on_pointer_down);
    return () => document.removeEventListener("mousedown", on_pointer_down);
  }, [open]);

  const select_timezone = useCallback(
    async (value: string) => {
      set_open(false);
      if (value === current_tz) return;

      set_pending(value);
      set_saving(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("No active session");

        const res = await fetch("/api/settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            settings: { general: { timezone: value || undefined } },
          }),
        });
        if (!res.ok) throw new Error("Failed to update timezone");

        await refetch();
      } catch {
        set_pending(null);
      } finally {
        set_saving(false);
      }
    },
    [current_tz, refetch],
  );

  if (!can_edit) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm">
        <GlobeIcon />
        <span className="truncate">Timezone: {label}</span>
      </div>
    );
  }

  const options: { value: string; label: string }[] = [
    { value: VISITOR_VALUE, label: "Use visitor's timezone" },
    ...TIMEZONE_OPTIONS.map((tz) => ({ value: tz, label: tz })),
  ];

  return (
    <div ref={root_ref} className="relative">
      <button
        type="button"
        onClick={() => set_open((value) => !value)}
        disabled={saving}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <GlobeIcon />
        <span className="truncate">Timezone: {label}</span>
        {saving ? (
          <>
            <svg
              className="h-4 w-4 shrink-0 animate-spin text-indigo-600"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth={4}
              />
              <path
                className="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
              />
            </svg>
            <span className="text-xs font-semibold text-indigo-600">Updating…</span>
          </>
        ) : (
          <svg
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          {options.map((option) => {
            const selected = option.value === current_tz;
            return (
              <button
                key={option.value || "visitor"}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => void select_timezone(option.value)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  selected
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {selected ? (
                  <svg
                    className="h-4 w-4 shrink-0 text-indigo-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
