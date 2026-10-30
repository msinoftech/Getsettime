import { strict as assert } from 'node:assert';
import type { event_type_recurrence } from '@/src/types/event_types';
import { list_scheduled_session_dates } from './scheduled_booking_dates';
import { is_event_type_booking_open } from './event_type_booking_window';

const TZ = 'Asia/Kolkata';

function one_time_group_recurrence(): event_type_recurrence {
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

function runScheduledDatesTests(): void {
  const event_type = {
    event_type_format: 'recurring',
    capacity_per_slot: 1,
    availability_mode: 'custom',
    duration_minutes: 10,
    recurrence: one_time_group_recurrence(),
  };

  const dates = list_scheduled_session_dates({
    event_type,
    provider_timezone: TZ,
    duration_minutes: 10,
  });

  assert.equal(dates.length, 9);
  assert.equal(
    dates[0].toISOString().slice(0, 10),
    new Date(2026, 8, 29).toISOString().slice(0, 10)
  );
  assert.equal(
    dates[8].toISOString().slice(0, 10),
    new Date(2026, 10, 24).toISOString().slice(0, 10)
  );
}

function runBookingOpenTests(): void {
  const event_type = {
    availability_mode: 'custom',
    recurrence: one_time_group_recurrence(),
  };

  const before_open = new Date('2026-09-25T18:00:00+05:30').getTime();
  const after_open = new Date('2026-09-25T20:00:00+05:30').getTime();

  assert.equal(is_event_type_booking_open(event_type, TZ, before_open), false);
  assert.equal(is_event_type_booking_open(event_type, TZ, after_open), true);
}

runScheduledDatesTests();
runBookingOpenTests();
console.log('scheduled_booking_dates tests passed');
