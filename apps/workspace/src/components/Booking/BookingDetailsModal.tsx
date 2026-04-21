'use client';

import React from 'react';
import {
  BookingDetailsCard,
  type BookingDetailsCardProps,
} from './BookingDetailsCard';

type BookingDetailsModalProps = Omit<BookingDetailsCardProps, 'variant'> & {
  onClose: () => void;
};

/**
 * Modal wrapper around {@link BookingDetailsCard}. The page-level variant of
 * the same details view lives at `/bookings/[id]` and reuses the card
 * directly.
 */
export function BookingDetailsModal({
  onClose,
  ...rest
}: BookingDetailsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:p-8"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full">
        <BookingDetailsCard
          {...rest}
          variant="modal"
          onClose={onClose}
        />
      </div>
    </div>
  );
}
