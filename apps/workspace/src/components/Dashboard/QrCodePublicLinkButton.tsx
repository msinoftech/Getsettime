"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import DashboardIcon from "./DashboardIcon";
import { useAuth } from "@/src/providers/AuthProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { ROLE_SERVICE_PROVIDER } from "@/src/constants/roles";
import {
  build_service_provider_public_booking_url,
  build_workspace_public_booking_url,
} from "@/src/utils/public_booking_link";

export default function QrCodePublicLinkButton() {
  const { user } = useAuth();
  const { workspaceSlug, serviceProviderLinkSlug, workspaceName } =
    useWorkspaceSettings();
  const [open, set_open] = useState(false);
  const [qr_data_url, set_qr_data_url] = useState<string | null>(null);
  const [generating, set_generating] = useState(false);

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
    if (!open || !booking_url) return;
    let cancelled = false;
    set_generating(true);
    QRCode.toDataURL(booking_url, { width: 320, margin: 2 })
      .then((url) => {
        if (!cancelled) set_qr_data_url(url);
      })
      .catch((error) => {
        console.error("Failed to generate QR code:", error);
        if (!cancelled) set_qr_data_url(null);
      })
      .finally(() => {
        if (!cancelled) set_generating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, booking_url]);

  const download_qr = useCallback(() => {
    if (!qr_data_url) return;
    const anchor = document.createElement("a");
    anchor.href = qr_data_url;
    const safe_name = (workspaceName || "booking")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    anchor.download = `${safe_name || "booking"}-qr-code.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, [qr_data_url, workspaceName]);

  return (
    <>
      <button
        type="button"
        onClick={() => set_open(true)}
        disabled={!booking_url}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <DashboardIcon name="qrCode" size={17} className="text-indigo-600" />
        QR Code
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Public booking QR code"
          onClick={() => set_open(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Booking page QR code
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Scan to open your public booking page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => set_open(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
              {generating || !qr_data_url ? (
                <div className="flex h-[288px] w-[288px] items-center justify-center text-sm text-slate-400">
                  {generating ? "Generating…" : "QR unavailable"}
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr_data_url}
                  alt="Public booking page QR code"
                  width={288}
                  height={288}
                  className="h-[288px] w-[288px]"
                />
              )}
            </div>

            {booking_url && (
              <p className="mt-3 break-all text-center text-xs text-slate-500">
                {booking_url}
              </p>
            )}

            <button
              type="button"
              onClick={download_qr}
              disabled={!qr_data_url}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <DashboardIcon name="arrow" size={17} className="rotate-90" />
              Download PNG
            </button>
          </div>
        </div>
      )}
    </>
  );
}
