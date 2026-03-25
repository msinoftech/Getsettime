'use client';

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-slate-200 animate-pulse ${className ?? ''}`}
    />
  );
}

const WORKFLOW_CARD_COUNT = 5;

function WorkflowCardSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-5 rounded-xl border border-slate-200 bg-white/70 shadow-md">
      <SkeletonBar className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonBar className="h-4 w-40 max-w-full" />
        <SkeletonBar className="h-3 w-full max-w-[220px]" />
      </div>
      <SkeletonBar className="w-10 h-5 rounded-full shrink-0" />
    </div>
  );
}

/** Main /notifications — workflow toggles grid */
export function NotificationsWorkflowsSkeleton() {
  return (
    <section className="space-y-6 rounded-xl mr-auto">
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500 space-y-2 w-full max-w-md">
          <SkeletonBar className="h-7 w-44" />
          <SkeletonBar className="h-3 w-full max-w-sm" />
        </div>
      </header>
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: WORKFLOW_CARD_COUNT }).map((_, i) => (
            <WorkflowCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

const ACTIVITY_ROW_COUNT = 8;

function ActivityRowSkeleton() {
  return (
    <div className="p-4 flex items-start gap-3">
      <SkeletonBar className="mt-0.5 h-8 w-8 rounded-full shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBar className="h-4 w-full max-w-md" />
        <SkeletonBar className="h-3 w-full max-w-lg" />
        <SkeletonBar className="h-3 w-48" />
      </div>
    </div>
  );
}

/** /notifications/all — activity feed list */
export function NotificationsActivityFeedSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
      {Array.from({ length: ACTIVITY_ROW_COUNT }).map((_, i) => (
        <ActivityRowSkeleton key={i} />
      ))}
    </div>
  );
}
