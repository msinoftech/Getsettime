'use client';

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-slate-200 animate-pulse ${className ?? ''}`}
    />
  );
}

function PanelSectionSkeleton({
  fields = 1,
  with_toggle = false,
}: {
  fields?: number;
  with_toggle?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <SkeletonBar className="h-6 w-6 rounded-full" />
        <SkeletonBar className="h-4 w-28" />
      </div>
      <div className="space-y-4">
        {with_toggle ? (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="space-y-1.5">
              <SkeletonBar className="h-4 w-20" />
              <SkeletonBar className="h-3 w-14" />
            </div>
            <SkeletonBar className="h-7 w-12 rounded-full" />
          </div>
        ) : (
          Array.from({ length: fields }).map((_, i) => (
            <div key={i}>
              <SkeletonBar className="mb-2 h-3 w-24" />
              <SkeletonBar className="h-10 w-full rounded-xl" />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function EventTypePanelSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-4 px-5 py-5">
        <PanelSectionSkeleton fields={3} />

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center gap-2.5">
            <SkeletonBar className="h-6 w-6 rounded-full" />
            <SkeletonBar className="h-4 w-28" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <SkeletonBar className="mb-2 h-3 w-20" />
                <SkeletonBar className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </section>

        <PanelSectionSkeleton with_toggle />

        <PanelSectionSkeleton fields={2} />
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <SkeletonBar className="h-10 w-full rounded-xl sm:w-24" />
          <SkeletonBar className="h-10 w-full rounded-xl sm:w-36" />
        </div>
      </div>
    </div>
  );
}

function EventTypeTableSkeleton() {
  return (
    <div className="overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBar key={i} className="h-3 w-20" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SkeletonBar className="h-9 w-9 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <SkeletonBar className="h-4 w-40" />
                <SkeletonBar className="h-3 w-24" />
              </div>
            </div>
            <SkeletonBar className="hidden h-4 w-14 sm:block" />
            <SkeletonBar className="hidden h-4 w-24 md:block" />
            <SkeletonBar className="hidden h-4 w-20 lg:block" />
            <SkeletonBar className="h-6 w-16 rounded-full" />
            <SkeletonBar className="h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EventTypePageFormSkeleton() {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 md:p-6">
      <div className="mb-6 space-y-3">
        <SkeletonBar className="h-3 w-24" />
        <SkeletonBar className="h-8 w-64" />
        <SkeletonBar className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 md:p-7">
          <div className="mb-6 space-y-2 border-b border-slate-100 pb-5">
            <SkeletonBar className="h-6 w-40" />
            <SkeletonBar className="h-4 w-72 max-w-full" />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <SkeletonBar className="h-12 rounded-2xl" />
            <SkeletonBar className="h-12 rounded-2xl" />
          </div>
          <SkeletonBar className="mt-6 h-40 rounded-[24px]" />
          <SkeletonBar className="mt-6 h-16 rounded-3xl" />
        </section>
        <aside className="rounded-[28px] border border-slate-200 bg-white p-5 md:p-6">
          <SkeletonBar className="mb-4 h-5 w-28" />
          <SkeletonBar className="h-56 rounded-[26px]" />
        </aside>
      </div>
    </div>
  );
}

export type event_type_skeleton_variant = 'table' | 'panel' | 'page';

export function EventTypeSkeleton({
  variant = 'table',
}: {
  variant?: event_type_skeleton_variant;
}) {
  if (variant === 'panel') {
    return <EventTypePanelSkeleton />;
  }

  if (variant === 'page') {
    return <EventTypePageFormSkeleton />;
  }

  return <EventTypeTableSkeleton />;
}
