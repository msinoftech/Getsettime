'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useWorkspaceSettings } from '@/src/hooks/useWorkspaceSettings';
import { build_workspace_public_booking_url } from '@/src/utils/public_booking_link';

type PreviewEventType = {
  title: string;
  duration_minutes: number | null;
};

function format_preview_slot(total_minutes: number): string {
  const normalized = ((total_minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour_24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const hour_12 = hour_24 % 12 === 0 ? 12 : hour_24 % 12;
  const minute_text = String(minute).padStart(2, '0');
  return `${hour_12}:${minute_text}`;
}

export function PublicBookingPreviewCard() {
  const {
    loading: loading_settings,
    workspaceSlug,
    workspaceName,
    general,
  } = useWorkspaceSettings();
  const [preview_event, set_preview_event] = useState<PreviewEventType | null>(null);

  const workspace_title =
    workspaceName?.trim() || general.accountName?.trim() || 'Your workspace';
  const initial = workspace_title.charAt(0).toUpperCase() || 'G';

  const booking_url = useMemo(
    () => build_workspace_public_booking_url(workspaceSlug),
    [workspaceSlug]
  );

  useEffect(() => {
    if (!booking_url) {
      set_preview_event(null);
      return;
    }

    let alive = true;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token || !alive) return;

        const res = await fetch('/api/event-types', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok || !alive) return;

        const json = (await res.json()) as {
          data?: Array<{
            title?: string;
            duration_minutes?: number | null;
            is_public?: boolean;
          }>;
        };

        const list = json.data ?? [];
        const picked =
          list.find((row) => row.is_public === true) ??
          list[0] ??
          null;

        if (!picked?.title || !alive) {
          set_preview_event(null);
          return;
        }

        set_preview_event({
          title: picked.title,
          duration_minutes:
            typeof picked.duration_minutes === 'number' ? picked.duration_minutes : null,
        });
      } catch {
        if (alive) set_preview_event(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [booking_url]);

  const duration_label =
    preview_event?.duration_minutes != null && preview_event.duration_minutes > 0
      ? `${Math.round(preview_event.duration_minutes)} min appointment`
      : 'Book online anytime';
  const preview_slots = useMemo(() => {
    const duration =
      preview_event?.duration_minutes != null && preview_event.duration_minutes > 0
        ? Math.round(preview_event.duration_minutes)
        : 30;
    const first_slot_minutes = 10 * 60;
    return Array.from({ length: 3 }, (_, index) =>
      format_preview_slot(first_slot_minutes + index * duration)
    );
  }, [preview_event?.duration_minutes]);

  const open_public_page = () => {
    if (!booking_url) return;
    window.open(booking_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="rounded-[26px] border border-white/25 bg-white/15 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="font-black text-white">Public Booking Preview</p>
        <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-black text-emerald-950">
          {booking_url ? 'Live' : 'Setup'}
        </span>
      </div>

      <div className="mt-5 rounded-3xl bg-white p-5 text-slate-900 shadow-lg">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-black text-white">
          {initial}
        </div>
        <h3 className="mt-4 text-lg font-black">
          {`${workspace_title}`}
        </h3>
        <p className="mt-1 text-sm text-slate-500">{duration_label}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600">
          {preview_slots.map((slot) => (
            <span key={slot} className="rounded-xl bg-slate-100 py-2">
              {slot}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={open_public_page}
          disabled={!booking_url}
          className="mt-4 w-full rounded-2xl bg-indigo-600 py-3 text-sm font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Book Appointment
        </button>
      </div>
    </div>
  );
}
