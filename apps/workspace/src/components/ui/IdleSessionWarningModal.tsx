"use client";

import { useEffect, useId, useRef } from "react";

interface IdleSessionWarningModalProps {
  open: boolean;
  secondsRemaining: number;
  onStaySignedIn: () => void;
}

export function IdleSessionWarningModal({
  open,
  secondsRemaining,
  onStaySignedIn,
}: IdleSessionWarningModalProps) {
  const titleId = useId();
  const descId = useId();
  const stayButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    stayButtonRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative bg-white rounded-xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200">
          <h2 id={titleId} className="text-xl font-semibold text-slate-800">
            Session timeout
          </h2>
        </div>
        <div className="p-6">
          <p id={descId} className="text-slate-700">
            You will be logged out due to inactivity in{" "}
            <span className="font-semibold tabular-nums">{secondsRemaining}</span>{" "}
            {secondsRemaining === 1 ? "second" : "seconds"}.
          </p>
          <div className="flex justify-end mt-6">
            <button
              ref={stayButtonRef}
              type="button"
              onClick={onStaySignedIn}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Stay signed in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
