import assert from 'node:assert/strict';
import {
  booking_preview_path,
  find_duplicate_invitee_booking_on_date,
  invitee_identities_match,
} from './invitee_duplicate_booking';

assert.equal(
  invitee_identities_match(
    { invitee_email: 'User@Example.com', invitee_phone: '+1 555 0100' },
    { invitee_email: 'user@example.com', invitee_phone: '15550100' }
  ),
  true
);

assert.equal(
  invitee_identities_match(
    { invitee_email: 'a@example.com' },
    { invitee_email: 'b@example.com', invitee_phone: '15550100' }
  ),
  false
);

const duplicate = find_duplicate_invitee_booking_on_date(
  [
    {
      id: 10,
      start_at: '2026-11-17T09:00:00.000Z',
      status: 'confirmed',
      event_type_id: 5,
      invitee_email: 'guest@example.com',
      invitee_phone: '+919876543210',
    },
  ],
  {
    start_at: '2026-11-17T14:00:00.000Z',
    timezone: 'UTC',
    event_type_id: 5,
    invitee: {
      invitee_email: 'guest@example.com',
      invitee_phone: '+919876543210',
    },
    exclude_booking_id: 99,
  }
);

assert.ok(duplicate);
assert.equal(String(duplicate.id), '10');

const excluded_self = find_duplicate_invitee_booking_on_date(
  [
    {
      id: 99,
      start_at: '2026-11-17T09:00:00.000Z',
      status: 'confirmed',
      event_type_id: 5,
      invitee_email: 'guest@example.com',
    },
  ],
  {
    start_at: '2026-11-17T14:00:00.000Z',
    timezone: 'UTC',
    event_type_id: 5,
    invitee: { invitee_email: 'guest@example.com' },
    exclude_booking_id: 99,
  }
);

assert.equal(excluded_self, null);

assert.equal(booking_preview_path('abc123'), '/booking-preview/abc123');
assert.equal(booking_preview_path('  '), null);

console.log('invitee_duplicate_booking.test.ts: ok');
