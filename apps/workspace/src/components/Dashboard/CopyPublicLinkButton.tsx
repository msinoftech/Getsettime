"use client";

import { useCallback, useMemo, useState } from "react";
import DashboardIcon from "./DashboardIcon";
import { useAuth } from "@/src/providers/AuthProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { ROLE_SERVICE_PROVIDER } from "@/src/constants/roles";
import {
  build_service_provider_public_booking_url,
  build_workspace_public_booking_url,
  copy_text_to_clipboard,
} from "@/src/utils/public_booking_link";

export default function CopyPublicLinkButton() {
  const { user } = useAuth();
  const { workspaceSlug, serviceProviderLinkSlug } = useWorkspaceSettings();
  const [copied, set_copied] = useState(false);

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

  const copy_link = useCallback(async () => {
    if (!booking_url) return;
    const ok = await copy_text_to_clipboard(booking_url);
    if (ok) {
      set_copied(true);
      window.setTimeout(() => set_copied(false), 1600);
    }
  }, [booking_url]);

  return (
    <button
      type="button"
      onClick={() => void copy_link()}
      disabled={!booking_url}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {copied ? (
        <DashboardIcon name="check" size={17} className="text-emerald-600" />
      ) : (
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
      )}
      {copied ? "Copied!" : "Copy Public Link"}
    </button>
  );
}
