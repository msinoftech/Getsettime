"use client";

import { useParams } from "next/navigation";
import { EventTypeEditForm } from "@/src/features/event-types/EventTypeEditForm";

export default function EventTypeEditPage() {
  const params = useParams<{ id: string }>();
  const eventTypeId = Number(params?.id);

  if (!Number.isFinite(eventTypeId) || eventTypeId < 1) {
    return (
      <section className="mr-auto space-y-6 rounded-2xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Invalid event type</h1>
          <p className="mt-2 text-sm text-slate-500">The event type id in the URL is not valid.</p>
        </div>
      </section>
    );
  }

  return <EventTypeEditForm eventTypeId={eventTypeId} />;
}
