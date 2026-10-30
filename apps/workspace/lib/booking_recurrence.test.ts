import { strict as assert } from 'node:assert';
import type { event_type_recurrence } from '@/src/types/event_types';
import {
  expand_recurrence_occurrences,
  find_scheduled_occurrence,
  recurrence_schedule_end_at,
  recurrence_session_limit,
} from './booking_recurrence';
import { event_type_session_duration_minutes } from '@/src/features/booking-flow/event_type_booking_flow';

const TZ = 'Asia/Kolkata';

/** Mirrors the "tyry" event type: weekly Tue 09:05, 9 sessions from 25-09. */
function one_time_recurrence(): event_type_recurrence {
  return {
    enabled: false,
    audience: 'group',
    frequency: 'weekly',
    days_of_week: ['tue'],
    start_date: '2026-09-25',
    start_time: '09:05',
    end_type: 'after',
    end_date: null,
    end_after_sessions: 9,
    allowed_frequency: 'weekly',
    session_preset: 4,
    custom_session_count: null,
    custom_availability_start: '2026-09-25T19:05',
    custom_availability_end: '2026-11-27T19:05',
  };
}

function group_class_recurrence(): event_type_recurrence {
  return {
    enabled: true,
    audience: 'group',
    frequency: 'daily',
    days_of_week: [],
    start_date: '2026-09-01',
    start_time: '13:30',
    end_type: 'never',
    end_date: null,
    end_after_sessions: null,
    allowed_frequency: 'daily',
    session_preset: 4,
    custom_session_count: null,
    custom_availability_start: '2026-09-01T00:00',
    custom_availability_end: '2026-10-30T23:59',
  };
}

function runSessionLimitTests(): void {
  const recurrence = one_time_recurrence();
  assert.equal(recurrence_session_limit(recurrence), 9);

  // Group/class repeating schedules ignore session_preset.
  assert.equal(recurrence_session_limit(group_class_recurrence()), null);

  // A wide window exposes the whole published schedule: 9 Tuesdays from 29-09.
  const schedule = expand_recurrence_occurrences({
    recurrence,
    timezone: TZ,
    duration_minutes: 10,
    window_days: 3650,
  });
  assert.equal(schedule.length, 9);
  assert.equal(schedule[0].date, '2026-09-29');
  assert.equal(schedule[8].date, '2026-11-24');
  for (const occurrence of schedule) {
    assert.equal(occurrence.time, '09:05');
    assert.equal(
      (new Date(occurrence.end_at).getTime() -
        new Date(occurrence.start_at).getTime()) /
        60_000,
      10
    );
  }
}

function runScheduleAnchorTests(): void {
  const recurrence = one_time_recurrence();

  // Dates before the schedule start are never offered, even when requested.
  const from_earlier = expand_recurrence_occurrences({
    recurrence,
    timezone: TZ,
    duration_minutes: 10,
    window_days: 3650,
    from_date: '2026-09-22',
  });
  assert.equal(from_earlier[0].date, '2026-09-29');

  // Selecting a later session keeps only the remaining ones.
  const from_later = expand_recurrence_occurrences({
    recurrence,
    timezone: TZ,
    duration_minutes: 10,
    window_days: 3650,
    include_from_at: '2026-10-20T03:35:00.000Z',
  });
  assert.equal(from_later.length, 6);
  assert.equal(from_later[0].date, '2026-10-20');
  assert.equal(from_later[5].date, '2026-11-24');
}

function runGroupClassScheduleTests(): void {
  const recurrence = group_class_recurrence();
  const sep_24 = expand_recurrence_occurrences({
    recurrence,
    timezone: TZ,
    duration_minutes: 30,
    window_days: 90,
    from_date: '2026-09-24',
  }).filter((occurrence) => occurrence.date === '2026-09-24');

  assert.equal(sep_24.length, 1);
  assert.equal(sep_24[0].time, '13:30');
}

function runBookingWindowTests(): void {
  const recurrence = one_time_recurrence();

  // The booking window caps generation even though the series ends on a count.
  const windowed = expand_recurrence_occurrences({
    recurrence,
    timezone: TZ,
    duration_minutes: 10,
    window_days: 30,
  });
  const cutoff = Date.now() + 31 * 86_400_000;
  assert.ok(windowed.length <= 9);
  for (const occurrence of windowed) {
    assert.ok(new Date(occurrence.start_at).getTime() < cutoff);
  }
}

function runScheduleEndTests(): void {
  assert.equal(
    recurrence_schedule_end_at({
      recurrence: one_time_recurrence(),
      timezone: TZ,
      duration_minutes: 10,
    }),
    '2026-11-24T03:45:00.000Z'
  );

  const open_ended: event_type_recurrence = {
    ...one_time_recurrence(),
    end_type: 'never',
    end_after_sessions: null,
    custom_availability_end: null,
  };
  assert.equal(
    recurrence_schedule_end_at({
      recurrence: open_ended,
      timezone: TZ,
      duration_minutes: 10,
    }),
    null
  );
}

function runScheduledOccurrenceLookupTests(): void {
  const recurrence = one_time_recurrence();
  const lookup = (start_at: string) =>
    find_scheduled_occurrence({
      recurrence,
      timezone: TZ,
      duration_minutes: 10,
      start_at,
      window_days: 3650,
    });

  const offered = lookup('2026-10-20T03:35:00.000Z');
  assert.ok(offered);
  assert.equal(offered?.end_at, '2026-10-20T03:45:00.000Z');

  // Before the schedule starts, off-pattern day, and after the last session.
  assert.equal(lookup('2026-09-22T03:35:00.000Z'), null);
  assert.equal(lookup('2026-10-21T03:35:00.000Z'), null);
  assert.equal(lookup('2026-12-15T03:35:00.000Z'), null);
}

function runSessionDurationTests(): void {
  const one_time = { event_type_format: 'recurring', duration_minutes: 10 };
  // Longer services must not stretch a published session.
  assert.equal(event_type_session_duration_minutes(one_time, 15), 10);

  const one_on_one = { event_type_format: 'one_on_one', duration_minutes: 10 };
  assert.equal(event_type_session_duration_minutes(one_on_one, 15), 15);
}

runSessionLimitTests();
runGroupClassScheduleTests();
runScheduleAnchorTests();
runBookingWindowTests();
runScheduleEndTests();
runScheduledOccurrenceLookupTests();
runSessionDurationTests();
console.log('booking_recurrence tests passed');
