"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DashboardIcon from "./DashboardIcon";
import { useAuth } from "@/src/providers/AuthProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { ROLE_SERVICE_PROVIDER } from "@/src/constants/roles";
import {
  build_service_provider_public_booking_url,
  build_workspace_public_booking_url,
  copy_text_to_clipboard,
  fetch_or_create_short_public_url,
} from "@/src/utils/public_booking_link";

type CopyKind = "public" | "short" | null;

const COPIED_FEEDBACK_MS = 2500;

export default function CopyPublicLinkButton() {
  const { user } = useAuth();
  const { workspaceSlug, serviceProviderLinkSlug } = useWorkspaceSettings();
  const [open, set_open] = useState(false);
  const [copied_kind, set_copied_kind] = useState<CopyKind>(null);
  const [short_loading, set_short_loading] = useState(false);
  const root_ref = useRef<HTMLDivElement>(null);
  const close_timer_ref = useRef<number | null>(null);

  const clear_close_timer = useCallback(() => {
    if (close_timer_ref.current !== null) {
      window.clearTimeout(close_timer_ref.current);
      close_timer_ref.current = null;
    }
  }, []);

  useEffect(() => () => clear_close_timer(), [clear_close_timer]);

  const is_service_provider =
    (user?.user_metadata?.role as string | undefined) === ROLE_SERVICE_PROVIDER;

  const booking_url = useMemo(() => {
    if (is_service_provider) {
      return build_service_provider_public_booking_url(
        workspaceSlug,
        serviceProviderLinkSlug,
      );
    }
    return build_workspace_public_booking_url(workspaceSlug);
  }, [is_service_provider, workspaceSlug, serviceProviderLinkSlug]);

  useEffect(() => {
    if (!open) return;
    const on_pointer_down = (event: MouseEvent) => {
      if (copied_kind !== null) return;
      if (!root_ref.current?.contains(event.target as Node)) {
        clear_close_timer();
        set_open(false);
      }
    };
    document.addEventListener("mousedown", on_pointer_down);
    return () => document.removeEventListener("mousedown", on_pointer_down);
  }, [open, copied_kind, clear_close_timer]);

  const show_copied = useCallback(
    (kind: CopyKind) => {
      clear_close_timer();
      set_copied_kind(kind);
      close_timer_ref.current = window.setTimeout(() => {
        set_copied_kind(null);
        set_open(false);
        close_timer_ref.current = null;
      }, COPIED_FEEDBACK_MS);
    },
    [clear_close_timer]
  );

  const copy_public_link = useCallback(async () => {
    if (!booking_url) return;
    const ok = await copy_text_to_clipboard(booking_url);
    if (ok) {
      show_copied("public");
    }
  }, [booking_url, show_copied]);

  const copy_short_link = useCallback(async () => {
    if (!booking_url || short_loading) return;
    set_short_loading(true);
    try {
      const short_url = await fetch_or_create_short_public_url(booking_url);
      if (!short_url) return;
      const ok = await copy_text_to_clipboard(short_url);
      if (ok) {
        show_copied("short");
      }
    } finally {
      set_short_loading(false);
    }
  }, [booking_url, short_loading, show_copied]);

  return (
    <div ref={root_ref} className="relative">
      <button
        type="button"
        onClick={() => {
          clear_close_timer();
          set_copied_kind(null);
          set_open((value) => !value);
        }}
        disabled={!booking_url}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          width={17}
          height={17}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        Public Link
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="text-slate-500"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void copy_public_link()}
            disabled={!booking_url}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied_kind === "public" ? (
              <DashboardIcon name="check" size={16} className="text-emerald-600" />
            ) : (
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
            {copied_kind === "public" ? "Copied!" : "Copy Public Link"}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => void copy_short_link()}
            disabled={!booking_url || short_loading}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied_kind === "short" ? (
              <DashboardIcon name="check" size={16} className="text-emerald-600" />
            ) : (
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            )}
            {short_loading
              ? "Creating..."
              : copied_kind === "short"
                ? "Copied!"
                : "Copy Short Link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
