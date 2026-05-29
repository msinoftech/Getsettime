'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useWorkspaceSettings } from '@/src/hooks/useWorkspaceSettings';
import {
  build_public_booking_qr_url,
  build_service_provider_public_booking_url,
  build_workspace_public_booking_url,
  copy_text_to_clipboard,
  download_public_booking_qr,
  open_public_booking_email,
  open_public_booking_whatsapp,
  share_public_booking_with_customer,
} from '@/src/utils/public_booking_link';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';
import { useAuth } from '@/src/providers/AuthProvider';
import DashboardIcon from './DashboardIcon';

type ModalKind = 'qr' | 'share' | null;

function MenuIcon({
  children,
  className = 'h-[17px] w-[17px] shrink-0',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function PublicBookingLinkMenu() {
  const { user } = useAuth();
  const {
    loading: loading_settings,
    workspaceSlug,
    serviceProviderLinkSlug,
    workspaceName,
    general,
  } = useWorkspaceSettings();

  const is_service_provider =
    (user?.user_metadata?.role as string | undefined) === ROLE_SERVICE_PROVIDER;

  const [open, set_open] = useState(false);
  const [modal, set_modal] = useState<ModalKind>(null);
  const [copied, set_copied] = useState(false);
  const [notice, set_notice] = useState('');
  const root_ref = useRef<HTMLDivElement>(null);

  const workspace_title =
    workspaceName?.trim() || general.accountName?.trim() || 'GetSetTime';

  const booking_url = useMemo(() => {
    if (is_service_provider) {
      return build_service_provider_public_booking_url(
        workspaceSlug,
        serviceProviderLinkSlug
      );
    }
    return build_workspace_public_booking_url(workspaceSlug);
  }, [is_service_provider, workspaceSlug, serviceProviderLinkSlug]);

  const qr_url = useMemo(
    () => (booking_url ? build_public_booking_qr_url(booking_url) : null),
    [booking_url]
  );

  const show_notice = useCallback((message: string) => {
    set_notice(message);
    window.setTimeout(() => set_notice(''), 2600);
  }, []);

  useEffect(() => {
    if (!open) return;
    const on_pointer_down = (event: MouseEvent) => {
      if (!root_ref.current?.contains(event.target as Node)) {
        set_open(false);
      }
    };
    document.addEventListener('mousedown', on_pointer_down);
    return () => document.removeEventListener('mousedown', on_pointer_down);
  }, [open]);

  const copy_link = useCallback(async () => {
    if (!booking_url) return;
    const ok = await copy_text_to_clipboard(booking_url);
    if (ok) {
      set_copied(true);
      show_notice('Booking link copied successfully.');
      window.setTimeout(() => set_copied(false), 1600);
      return;
    }
    set_modal('share');
    show_notice('Copy was blocked. Use the share options below.');
  }, [booking_url, show_notice]);

  const share_with_customer = useCallback(async () => {
    if (!booking_url) return;
    const result = await share_public_booking_with_customer(booking_url, workspace_title);
    if (result === 'shared') {
      show_notice('Shared with customer.');
      set_open(false);
      return;
    }
    if (result === 'cancelled') return;
    set_modal('share');
    set_open(false);
  }, [booking_url, workspace_title, show_notice]);

  const open_public_page = useCallback(() => {
    if (!booking_url) return;
    window.open(booking_url, '_blank', 'noopener,noreferrer');
    set_open(false);
  }, [booking_url]);

  const download_qr = useCallback(async () => {
    if (!booking_url) return;
    const ok = await download_public_booking_qr(booking_url);
    show_notice(
      ok ? 'QR code downloaded.' : 'QR download failed. Right-click the image to save it.'
    );
  }, [booking_url, show_notice]);

  // if (loading_settings) {
  //   return (
  //     <span className="inline-flex h-[46px] items-center rounded-2xl bg-emerald-400/50 px-5 text-sm font-black text-emerald-950/60">
  //       Public Booking Link
  //     </span>
  //   );
  // }

  // if (!booking_url) {
  //   return (
  //     <Link
  //       href="/settings"
  //       className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-emerald-950 shadow-xl transition hover:bg-emerald-300"
  //       title="Configure My Link in Settings"
  //     >
  //       <MenuIcon>
  //         <circle cx="18" cy="5" r="3" />
  //         <circle cx="6" cy="12" r="3" />
  //         <circle cx="18" cy="19" r="3" />
  //         <path d="m8.59 13.51 6.83 3.98" />
  //         <path d="M15.41 6.51l-6.82 3.98" />
  //       </MenuIcon>
  //       Public Booking Link
  //     </Link>
  //   );
  // }

  return (
    <>
      {notice ? (
        <div
          role="status"
          className="fixed right-6 top-20 z-[60] flex max-w-sm items-start gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-2xl"
        >
          <DashboardIcon name="alert" size={18} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      ) : null}

      <div ref={root_ref} className="relative z-50">
        <button
          type="button"
          onClick={() => set_open((value) => !value)}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-emerald-950 shadow-xl transition hover:bg-emerald-300"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <MenuIcon>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.59 13.51 6.83 3.98" />
            <path d="M15.41 6.51l-6.82 3.98" />
          </MenuIcon>
          Public Booking Link
          <MenuIcon className="h-4 w-4">
            <path d="m6 9 6 6 6-6" />
          </MenuIcon>
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-2 w-80 rounded-3xl bg-white p-3 text-slate-900 shadow-2xl ring-1 ring-slate-200"
          >
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-500">Your public booking URL</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-800" title={booking_url ?? undefined}>
                {booking_url}
              </p>
            </div>

            <div className="mt-3 space-y-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => void copy_link()}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold hover:bg-slate-100"
              >
                {copied ? (
                  <MenuIcon className="text-emerald-600">
                    <path d="M20 6 9 17l-5-5" />
                  </MenuIcon>
                ) : (
                  <MenuIcon>
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </MenuIcon>
                )}
                {copied ? 'Copied link' : 'Copy Link'}
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => void share_with_customer()}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold hover:bg-slate-100"
              >
                <MenuIcon>
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="m8.59 13.51 6.83 3.98" />
                  <path d="M15.41 6.51l-6.82 3.98" />
                </MenuIcon>
                Share with Customer
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  set_open(false);
                  set_modal('qr');
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold hover:bg-slate-100"
              >
                <MenuIcon>
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <path d="M14 14h.01" />
                  <path d="M18 14h.01" />
                  <path d="M14 18h.01" />
                  <path d="M18 18h.01" />
                </MenuIcon>
                Generate QR Code
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={open_public_page}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold hover:bg-slate-100"
              >
                <MenuIcon>
                  <path d="M15 3h6v6" />
                  <path d="M10 14 21 3" />
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </MenuIcon>
                Open Public Page
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900">
                {modal === 'qr' ? 'Booking QR Code' : 'Share Booking Link'}
              </h2>
              <button
                type="button"
                onClick={() => set_modal(null)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <MenuIcon className="h-5 w-5">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </MenuIcon>
              </button>
            </div>

            {modal === 'qr' && qr_url ? (
              <div className="mt-5 text-center">
                <div className="inline-flex rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qr_url}
                    alt="Booking QR Code"
                    className="h-56 w-56 rounded-2xl"
                  />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-500">
                  Customers can scan this QR code to open your booking page.
                </p>
                <button
                  type="button"
                  onClick={() => void download_qr()}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700"
                >
                  <MenuIcon className="h-[17px] w-[17px]">
                    <path d="M12 15V3" />
                    <path d="m7 8 5-5 5 5" />
                    <path d="M20 16.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5" />
                  </MenuIcon>
                  Download QR Code
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">Share this booking URL</p>
                  <p className="mt-1 break-all text-sm font-semibold text-slate-800">
                    {booking_url}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!booking_url) return;
                    open_public_booking_whatsapp(booking_url, workspace_title);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-green-50 px-4 py-4 text-sm font-black text-green-700 hover:bg-green-100"
                >
                  <MenuIcon className="h-5 w-5">
                    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
                  </MenuIcon>
                  Share on WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!booking_url) return;
                    open_public_booking_email(booking_url, workspace_title);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-indigo-50 px-4 py-4 text-sm font-black text-indigo-700 hover:bg-indigo-100"
                >
                  <MenuIcon className="h-5 w-5">
                    <path d="M4 6h16v12H4z" />
                    <path d="m4 7 8 6 8-6" />
                  </MenuIcon>
                  Share by Email
                </button>
                <button
                  type="button"
                  onClick={() => void copy_link()}
                  className="flex w-full items-center gap-3 rounded-2xl bg-slate-100 px-4 py-4 text-sm font-black text-slate-700 hover:bg-slate-200"
                >
                  {copied ? (
                    <MenuIcon className="h-5 w-5 text-emerald-600">
                      <path d="M20 6 9 17l-5-5" />
                    </MenuIcon>
                  ) : (
                    <MenuIcon className="h-5 w-5">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </MenuIcon>
                  )}
                  {copied ? 'Copied' : 'Copy Link'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
