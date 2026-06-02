"use client";

import Link from "next/link";

interface UpgradePlanModalProps {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

export function UpgradePlanModal({
  open,
  title = "Upgrade required",
  message,
  onClose,
}: UpgradePlanModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-plan-modal-title"
    >
      <div
        className="relative w-full max-w-md rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 p-6">
          <h3 id="upgrade-plan-modal-title" className="text-xl font-semibold text-slate-800">
            {title}
          </h3>
        </div>
        <div className="p-6">
          <p className="text-slate-700">{message}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-100 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-200"
            >
              Not now
            </button>
            <Link
              href="/billings"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
              onClick={onClose}
            >
              Upgrade Plan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
