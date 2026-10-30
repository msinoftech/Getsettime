import { strict as assert } from 'node:assert';
import type { event_type_recurrence } from '@/src/types/event_types';
import { resolve_series_booking_occurrences } from './booking_series_service';

const TZ = 'Asia/Kolkata';

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

function runSeriesOccurrenceTests(): void {
  const recurrence = one_time_recurrence();
  const nov_24_start = '2026-11-24T03:35:00.000Z';

  const from_last = resolve_series_booking_occurrences({
    recurrence,
    timezone: TZ,
    duration_minutes: 10,
    selected_start_at: nov_24_start,
    max_booking_window_days: 180,
    now_iso: '2026-09-26T00:00:00.000Z',
  });

  assert.equal(from_last.ok, true);
  if (!from_last.ok) return;
  assert.equal(from_last.schedule.length, 9);
  assert.equal(from_last.occurrences.length, 9);
  assert.equal(from_last.occurrences[0].date, '2026-09-29');
  assert.equal(from_last.occurrences[8].date, '2026-11-24');

  const from_first = resolve_series_booking_occurrences({
    recurrence,
    timezone: TZ,
    duration_minutes: 10,
    selected_start_at: from_last.schedule[0].start_at,
    max_booking_window_days: 180,
    now_iso: '2026-09-26T00:00:00.000Z',
  });

  assert.equal(from_first.ok, true);
  if (!from_first.ok) return;
  assert.deepEqual(
    from_first.occurrences.map((occurrence) => occurrence.date),
    from_last.occurrences.map((occurrence) => occurrence.date)
  );
}

runSeriesOccurrenceTests();
console.log('booking_series_service tests passed');
