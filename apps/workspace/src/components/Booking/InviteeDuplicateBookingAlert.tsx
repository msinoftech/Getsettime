'use client';

import React from 'react';

type InviteeDuplicateBookingAlertProps = {
  message: string;
  previewPath?: string | null;
  className?: string;
};

function resolve_preview_href(previewPath: string): string {
  if (/^https?:\/\//i.test(previewPath)) return previewPath;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${previewPath.startsWith('/') ? previewPath : `/${previewPath}`}`;
  }
  return previewPath.startsWith('/') ? previewPath : `/${previewPath}`;
}

export function InviteeDuplicateBookingAlert({
  message,
  previewPath,
  className = '',
}: InviteeDuplicateBookingAlertProps) {
  const href = previewPath?.trim() ? resolve_preview_href(previewPath.trim()) : null;

  return (
    <div
      className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 ${className}`.trim()}
      role="alert"
    >
      <p>{message}</p>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center font-medium text-red-900 underline underline-offset-2 hover:text-red-950"
        >
          View your existing booking
        </a>
      )}
    </div>
  );
}
