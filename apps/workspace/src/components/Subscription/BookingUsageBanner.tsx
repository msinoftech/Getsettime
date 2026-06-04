"use client";

import Link from "next/link";
import { useAuth } from "@/src/providers/AuthProvider";
import { useSubscription } from "@/src/hooks/useSubscription";
import { formatBookingLimitLabel, isUnlimitedBookingLimit } from "@app/db/subscription";

export function BookingUsageBanner() {
  const { user } = useAuth();
  const { data, loading } = useSubscription(Boolean(user));

  if (loading || !data?.thresholds.booking_warning) return null;
  if (data.thresholds.booking_limit_reached) return null;
  if (isUnlimitedBookingLimit(data.usage.booking_limit)) return null;

  const { bookings_this_month, booking_limit } = data.usage;

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p>
        You&apos;ve used <strong>{bookings_this_month}</strong> of{" "}
        <strong>{formatBookingLimitLabel(booking_limit)}</strong> monthly bookings.
      </p>
      <p className="mt-1">
        Upgrade to continue accepting appointments without interruption.{" "}
        <Link href="/billings" className="font-medium text-indigo-700 underline hover:text-indigo-900">
          Upgrade Plan
        </Link>
      </p>
    </div>
  );
}
