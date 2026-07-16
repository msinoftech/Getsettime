"use client";

import { useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/src/providers/AuthProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { TIMEZONE_OPTIONS } from "@/src/constants/timezone";
import { MANAGE_ROLES } from "@/src/constants/roles";
import { TimezoneSelector } from "@/src/components/ui/TimezoneSelector";

const VISITOR_VALUE = "";

function tz_abbreviation(tz: string): string | null {
  if (!tz) return null;
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

function format_dashboard_label(tz: string): string {
  if (!tz) return "Visitor's timezone";
  const abbr = tz_abbreviation(tz);
  return abbr ? `${tz} (${abbr})` : tz;
}

export default function DashboardTimezoneSelect() {
  const { user } = useAuth();
  const { general, settings, refetch } = useWorkspaceSettings();

  const role = (user?.user_metadata?.role as string | undefined) ?? "";
  const can_edit = MANAGE_ROLES.includes(role);

  const current_tz = (general?.timezone ?? settings.general?.timezone ?? "").trim();

  const options = [
    { value: VISITOR_VALUE, label: "Use visitor's timezone" },
    ...TIMEZONE_OPTIONS.map((tz) => ({ value: tz, label: tz })),
  ];

  const save_timezone = useCallback(
    async (value: string) => {
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
    },
    [refetch],
  );

  return (
    <TimezoneSelector
      timezone={current_tz}
      options={options}
      formatLabel={format_dashboard_label}
      onSave={can_edit ? save_timezone : undefined}
      readOnly={!can_edit}
      variant="pill"
      actionsAlign="right"
    />
  );
}
