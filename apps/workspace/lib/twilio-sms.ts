import { parsePhoneNumberWithError, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Validate a phone number using libphonenumber-js.
 * Accepts numbers with or without country code; defaults to IN (India) when ambiguous.
 */
export function isValidPhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return false;
  try {
    return isValidPhoneNumber(trimmed, 'IN');
  } catch {
    return false;
  }
}

/**
 * Normalize a phone string to E.164 format (e.g. +919530693882).
 * Returns null when the number cannot be parsed or is invalid.
 */
export function toE164(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  try {
    const parsed = parsePhoneNumberWithError(trimmed, 'IN');
    if (!parsed || !parsed.isValid()) return null;
    return parsed.format('E.164');
  } catch {
    return null;
  }
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

  // if (process.env.NODE_ENV === 'development') {
  //   console.log(`[twilio-sms][DEV] Would send SMS to ${to}: ${body}`);
  //   return true;
  // }

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
