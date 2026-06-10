import { strict as assert } from 'node:assert';
import type { AvailabilitySettings, Booking, EventType } from '../types/bookingForm';
import {
  resolveEffectiveBookingDurationMinutes,
  sumSelectedServiceDurationMinutes,
} from './bookingDuration';
import { buildTimeslotsForDay } from './bookingTime';

function runDurationHelperTests(): void {
  const eventType = { duration_minutes: 15 };
  const catalog = [
    { id: 'a', duration: 45 },
    { id: 'b', duration: 15 },
    { id: 'c', duration: 30 },
  ];

  assert.equal(
    resolveEffectiveBookingDurationMinutes(eventType, [], catalog),
    15
  );
  assert.equal(
    resolveEffectiveBookingDurationMinutes(eventType, ['a'], catalog),
    45
  );
  assert.equal(
    resolveEffectiveBookingDurationMinutes(
      { duration_minutes: 30 },
      ['b', 'c'],
      catalog
    ),
    45
  );
  assert.equal(
    resolveEffectiveBookingDurationMinutes(
      { duration_minutes: 30 },
      ['b'],
      catalog
    ),
    30
  );
  assert.equal(sumSelectedServiceDurationMinutes(['b', 'c'], catalog), 45);
}

function runSlotSpacingTests(): void {
  const eventType: EventType = {
    id: 'et-1',
    title: 'Test',
    slug: 'test',
    duration_minutes: 15,
    location_type: null,
    is_public: true,
  };
  const availability: AvailabilitySettings = {
    timesheet: {
      Sun: { enabled: false, startTime: '09:00', endTime: '17:00', breaks: [] },
      Mon: { enabled: false, startTime: '09:00', endTime: '17:00', breaks: [] },
      Tue: { enabled: false, startTime: '09:00', endTime: '17:00', breaks: [] },
      Wed: { enabled: false, startTime: '09:00', endTime: '17:00', breaks: [] },
      Thu: { enabled: false, startTime: '09:00', endTime: '17:00', breaks: [] },
      Fri: { enabled: true, startTime: '09:00', endTime: '17:00', breaks: [] },
      Sat: { enabled: false, startTime: '09:00', endTime: '17:00', breaks: [] },
    },
  };
  const friday = new Date();
  friday.setFullYear(friday.getFullYear() + 1);
  friday.setMonth(5);
  friday.setDate(5);
  while (friday.getDay() !== 5) {
    friday.setDate(friday.getDate() + 1);
  }
  friday.setHours(0, 0, 0, 0);
  assert.equal(friday.getDay(), 5);

  const tz = 'Asia/Kolkata';
  const slots15 = buildTimeslotsForDay(
    eventType,
    friday,
    availability,
    [],
    0,
    15,
    tz,
    tz
  ).filter((s) => !s.disabled);
  assert.ok(slots15.length >= 3);
  assert.ok(slots15.every((s) => s.startUtc));
  assert.match(slots15[0].time, /^9:00 AM/);

  const slots45 = buildTimeslotsForDay(
    eventType,
    friday,
    availability,
    [],
    0,
    45,
    tz,
    tz
  ).filter((s) => !s.disabled);
  assert.ok(slots45.length >= 3);
  assert.match(slots45[0].time, /^9:00 AM/);
  assert.match(slots45[1].time, /^9:45 AM/);

  const bookingStart = new Date(friday);
  bookingStart.setHours(10, 0, 0, 0);
  const bookingEnd = new Date(bookingStart);
  bookingEnd.setMinutes(bookingEnd.getMinutes() + 45);
  const existing: Booking[] = [
    {
      id: 'b1',
      start_at: bookingStart.toISOString(),
      end_at: bookingEnd.toISOString(),
      status: 'confirmed',
    },
  ];

  const afterBooking = buildTimeslotsForDay(
    eventType,
    friday,
    availability,
    existing,
    0,
    45,
    tz,
    tz
  ).filter((s) => !s.disabled);
  const enabledTimes = afterBooking.map((s) => s.time);
  assert.ok(enabledTimes.some((t) => t.startsWith('10:45 AM')));
  assert.ok(!enabledTimes.some((t) => t.startsWith('10:00 AM')));
  assert.ok(!enabledTimes.some((t) => t.startsWith('10:30 AM')));
}

runDurationHelperTests();
runSlotSpacingTests();
console.log('bookingDuration tests passed');
