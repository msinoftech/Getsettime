const PREFIX = '[booking-step3-perf]';

let pendingDateClickAt: number | null = null;
let pendingSlotClickAt: number | null = null;

export function step3PerfDateClickStart(dateLabel: string): void {
  pendingDateClickAt = performance.now();
  console.log(`${PREFIX} date click`, { date: dateLabel });
}

export function step3PerfSlotClickStart(slotTime: string): void {
  pendingSlotClickAt = performance.now();
  console.log(`${PREFIX} timeslot click`, { time: slotTime });
}

/** Call when selectedDate state has committed and slots are available. */
export function step3PerfDateCommitted(
  date: Date | null,
  enabledSlotCount: number
): void {
  if (pendingDateClickAt == null) return;
  const ms = performance.now() - pendingDateClickAt;
  console.log(`${PREFIX} date selection committed`, {
    ms: `${ms.toFixed(1)}ms`,
    date: date?.toDateString() ?? null,
    enabledSlotCount,
  });
  pendingDateClickAt = null;
}

/** Call when selectedTime/startUtc state has committed (sidebar can show it). */
export function step3PerfSlotCommitted(time: string, startUtc: string | null): void {
  if (pendingSlotClickAt == null) return;
  const ms = performance.now() - pendingSlotClickAt;
  console.log(`${PREFIX} timeslot selection committed`, {
    ms: `${ms.toFixed(1)}ms`,
    time,
    startUtc,
  });
  pendingSlotClickAt = null;
}

export function step3PerfSync(
  label: string,
  startedAt: number,
  extra?: Record<string, unknown>
): void {
  console.log(`${PREFIX} ${label}`, {
    ms: `${(performance.now() - startedAt).toFixed(1)}ms`,
    ...extra,
  });
}

export function step3PerfLog(label: string, extra?: Record<string, unknown>): void {
  console.log(`${PREFIX} ${label}`, extra ?? '');
}

/** Sidebar painted with new date (useLayoutEffect). */
export function step3PerfSidebarDateRendered(date: Date): void {
  if (pendingDateClickAt == null) return;
  const ms = performance.now() - pendingDateClickAt;
  console.log(`${PREFIX} sidebar date visible (layout)`, {
    ms: `${ms.toFixed(1)}ms`,
    date: date.toDateString(),
  });
}

/** Sidebar painted with new time (useLayoutEffect). */
export function step3PerfSidebarTimeRendered(time: string): void {
  if (pendingSlotClickAt == null) return;
  const ms = performance.now() - pendingSlotClickAt;
  console.log(`${PREFIX} sidebar time visible (layout)`, {
    ms: `${ms.toFixed(1)}ms`,
    time,
  });
}
