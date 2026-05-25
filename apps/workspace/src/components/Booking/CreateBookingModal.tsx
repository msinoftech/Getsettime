"use client";

import { useCallback } from "react";
import MultiStepBookingForm from "@/src/components/Booking/MultiStepBookingForm";

type CreateBookingModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function CreateBookingModal({
  open,
  onClose,
  onSaved,
}: CreateBookingModalProps) {
  const handleSave = useCallback(() => {
    onClose();
    onSaved?.();
    window.dispatchEvent(new Event("bookings-viewed-update"));
  }, [onClose, onSaved]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-999 m-0 overflow-y-auto bg-gray-50 bg-opacity-50"
      role="presentation"
      onClick={handleSave}
    >
      <div
        className="relative mx-auto h-full w-full"
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleSave}
          className="fixed right-2 top-2 z-10 rounded-full text-slate-500 transition-colors hover:text-slate-700"
          aria-label="Close modal"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <MultiStepBookingForm onSave={handleSave} onCancel={onClose} />
      </div>
    </div>
  );
}
