import { strict as assert } from 'node:assert';
import {
  embedOtpIdentifier,
  normalizeEmbedOtpEmail,
  phoneDigitsForEmbedOtp,
} from './embed-booking-otp-id';

assert.equal(embedOtpIdentifier(42, '+919876543210'), '42:919876543210');
assert.equal(normalizeEmbedOtpEmail('  User@Example.COM '), 'user@example.com');
assert.equal(phoneDigitsForEmbedOtp('+1 (555) 123-4567'), '15551234567');

console.log('embed-booking-otp-id.test.ts: ok');
