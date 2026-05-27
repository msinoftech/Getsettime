"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreateBookingModal } from "@/src/providers/CreateBookingModalProvider";

/** Opens the in-shell create booking modal and sends the user to the list (sidebar/topbar stay visible). */
export default function BookingsNewModalEntryPage() {
  const router = useRouter();
  const { open } = useCreateBookingModal();

  useEffect(() => {
    open();
    router.replace("/bookings");
  }, [open, router]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
      Opening create booking…
    </div>
  );
}
