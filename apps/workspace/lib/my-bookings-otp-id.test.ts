import { strict as assert } from 'node:assert';
import {
  maskEmailHint,
  myBookingsOtpIdentifier,
  phoneDigitsForMyBookingsOtp,
} from './my-bookings-otp-id';
import {
  phoneMatchesStored,
  resolveEmailFromMatchedBookings,
  type MyBookingsBookingRow,
} from './my-bookings-phone-match';

assert.equal(myBookingsOtpIdentifier('+919876543210'), 'my-bookings:919876543210');
assert.equal(phoneDigitsForMyBookingsOtp('+1 (555) 123-4567'), '15551234567');
assert.equal(maskEmailHint('Jane.Doe@Example.com'), 'j***@example.com');

assert.equal(phoneMatchesStored('+919876543210', '+919876543210'), true);
assert.equal(phoneMatchesStored('9876543210', '+919876543210'), true);
assert.equal(phoneMatchesStored(null, '+919876543210'), false);

const rows: MyBookingsBookingRow[] = [
  {
    id: '1',
    contact_id: null,
    invitee_email: 'old@example.com',
    invitee_phone: '+911111111111',
    start_at: '2024-01-01T10:00:00Z',
    created_at: '2023-12-01T10:00:00Z',
    contacts: null,
  },
  {
    id: '2',
    contact_id: null,
    invitee_email: 'recent@example.com',
    invitee_phone: '+911111111111',
    start_at: '2025-06-01T10:00:00Z',
    created_at: '2025-05-01T10:00:00Z',
    contacts: null,
  },
];
assert.equal(resolveEmailFromMatchedBookings(rows), 'recent@example.com');

console.log('my-bookings-otp-id.test.ts: ok');
