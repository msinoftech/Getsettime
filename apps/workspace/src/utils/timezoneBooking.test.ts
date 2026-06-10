import assert from 'node:assert/strict';
import { localDateTimeToUtcIso, getCalendarDateInTimezone } from '@/lib/date-timezone';
import { buildTimeslotsForDay } from '@/src/utils/bookingTime';
import { resolveProviderTimezone, needsTimezoneConversion } from '@/src/utils/timezone';
import type { AvailabilitySettings, EventType } from '@/src/types/bookingForm';

function testLocalToUtcIst() {
  const utc = localDateTimeToUtcIso('2026-06-08', 10, 0, 'Asia/Kolkata');
  const inNy = getCalendarDateInTimezone(utc, 'America/New_York');
  assert.equal(typeof inNy, 'string');
  assert.match(inNy, /^\d{4}-\d{2}-\d{2}$/);
}

function testProviderVisitorMode() {
  assert.equal(resolveProviderTimezone('', 'America/New_York'), 'America/New_York');
  assert.equal(resolveProviderTimezone('Asia/Kolkata', 'America/New_York'), 'Asia/Kolkata');
  assert.equal(needsTimezoneConversion('Asia/Kolkata', 'America/New_York'), true);
  assert.equal(needsTimezoneConversion('America/New_York', 'America/New_York'), false);
}

function testSlotBuilderSameZone() {
  const eventType: EventType = {
    id: '1',
    title: 'Test',
    duration_minutes: 30,
    slug: 'test',
  };
  const availability: AvailabilitySettings = {
    timesheet: {
      Mon: { enabled: true, startTime: '09:00', endTime: '12:00', breaks: [] },
      Tue: { enabled: false, startTime: '09:00', endTime: '17:00', breaks: [] },
      Wed: { enabled: false, startTime: '09:00', endTime: '17:00', breaks: [] },
      Thu: { enabled: false, startTime: '09:00', endTime: '17:00', breaks: [] },
      Fri: { enabled: false, startTime: '09:00', endTime: '17:00', breaks: [] },
      Sat: { enabled: false, startTime: '09:00', endTime: '17:00', breaks: [] },
      Sun: { enabled: false, startTime: '09:00', endTime: '17:00', breaks: [] },
    },
  };
  const monday = new Date(2027, 5, 7);
  const slots = buildTimeslotsForDay(
    eventType,
    monday,
    availability,
    [],
    0,
    30,
    'Asia/Kolkata',
    'Asia/Kolkata'
  );
  assert.ok(slots.some((s) => !s.disabled && s.startUtc));
}

testLocalToUtcIst();
testProviderVisitorMode();
testSlotBuilderSameZone();
console.log('timezoneBooking.test.ts: all passed');
