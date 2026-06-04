import {
  isValidPhone as isValidPhoneUtil,
  toE164 as toE164Util,
} from '@/src/utils/phone';
import type { CountryCode } from 'libphonenumber-js';

export function isValidPhone(phone: string, defaultCountry?: CountryCode): boolean {
  return isValidPhoneUtil(phone, defaultCountry);
}

export function toE164(phone: string, defaultCountry?: CountryCode): string | null {
  return toE164Util(phone, defaultCountry);
}

/**
 * Send an SMS via Twilio.
 * Returns true on success, false on failure. Never throws.
 */
export async function sendSMS(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('[twilio-sms] Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER – skipping SMS');
    return false;
  }

  try {
    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);
    await client.messages.create({ body, from: fromNumber, to });
    return true;
  } catch (error) {
    console.error('[twilio-sms] Failed to send SMS:', error);
    return false;
  }
}
