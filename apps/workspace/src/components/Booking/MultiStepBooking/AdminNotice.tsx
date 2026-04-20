'use client';

import React, { useEffect, useRef, useState } from 'react';

interface AdminNoticeIconProps {
  notice: string;
  className?: string;
}

/**
 * Small info icon rendered in the top-right corner of the booking form.
 * Reveals the admin notice in a popover on hover/focus/click.
 */
export function AdminNoticeIcon({ notice, className }: AdminNoticeIconProps) {
  const [open, set_open] = useState(false);
  const container_ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handle_click = (event: MouseEvent) => {
      if (!container_ref.current) return;
      if (!container_ref.current.contains(event.target as Node)) {
        set_open(false);
      }
    };
    const handle_escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') set_open(false);
    };
    document.addEventListener('mousedown', handle_click);
    document.addEventListener('keydown', handle_escape);
    return () => {
      document.removeEventListener('mousedown', handle_click);
      document.removeEventListener('keydown', handle_escape);
    };
  }, [open]);

  return (
    <div
      ref={container_ref}
      className={`relative z-20 ${className ?? ''}`}
      onMouseEnter={() => set_open(true)}
      onMouseLeave={() => set_open(false)}
    >
      <button
        type="button"
        aria-label="View admin notice"
        aria-expanded={open}
        onClick={() => set_open((prev) => !prev)}
        onFocus={() => set_open(true)}
        onBlur={() => set_open(false)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[80vw] rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700 shadow-xl"
        >
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
            Admin Notice
          </p>
          <p className="whitespace-pre-line">{notice}</p>
        </div>
      )}
    </div>
  );
}

interface AdminNoticeBannerProps {
  notice: string;
  className?: string;
}

/**
 * Persistent bottom banner showing the admin notice across all steps.
 */
export function AdminNoticeBanner({ notice, className }: AdminNoticeBannerProps) {
  return (
    <div
      className={`mt-6 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs leading-relaxed text-slate-700 ${className ?? ''}`}
      role="note"
    >
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-indigo-600 text-white">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </span>
      <div>
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
          Admin Notice
        </p>
        <p className="whitespace-pre-line">{notice}</p>
      </div>
    </div>
  );
}
