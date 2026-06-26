'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import DashboardIcon from '@/src/components/Dashboard/DashboardIcon';
import { useWorkspaceSettings } from '@/src/hooks/useWorkspaceSettings';
import { build_service_provider_public_booking_url, build_workspace_public_booking_url } from '@/src/utils/public_booking_link';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';
import { useAuth } from '@/src/providers/AuthProvider';
import { useCreateBookingModal } from '@/src/providers/CreateBookingModalProvider';

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
  const { user } = useAuth();
  const { open: open_create_booking } = useCreateBookingModal();
  const {
    loading: loading_settings,
    workspaceSlug,
    serviceProviderLinkSlug,
    workspaceName,
    general,
  } = useWorkspaceSettings();

  const is_service_provider =
    (user?.user_metadata?.role as string | undefined) === ROLE_SERVICE_PROVIDER;
  const [preview_event, set_preview_event] = useState<PreviewEventType | null>(null);

  const workspace_title =
    workspaceName?.trim() || general.accountName?.trim() || 'Your workspace';
  const initial = workspace_title.charAt(0).toUpperCase() || 'G';

  const booking_url = useMemo(() => {
    if (is_service_provider) {
      return build_service_provider_public_booking_url(
        workspaceSlug,
        serviceProviderLinkSlug
      );
    }
    return build_workspace_public_booking_url(workspaceSlug);
  }, [is_service_provider, workspaceSlug, serviceProviderLinkSlug]);

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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Live Booking Page Preview</h3>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          {booking_url ? 'Live' : 'Setup'}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-5 text-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-base font-bold text-slate-900">
              {workspace_title}
            </h4>
            <p className="text-sm text-slate-500">{duration_label}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-600">
          {preview_slots.map((slot) => (
            <span
              key={slot}
              className="rounded-xl border border-slate-200 bg-white py-2"
            >
              {slot}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={open_create_booking}
          className="mt-4 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
        >
          Book Appointment
        </button>
        <button
          type="button"
          onClick={open_public_page}
          disabled={!booking_url}
          className="mt-3 flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <DashboardIcon name="externalLink" size={16} />
          Open booking page
        </button>
      </div>
    </div>
  );
}
