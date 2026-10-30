import { NextRequest, NextResponse } from 'next/server';
import { normalizeInviteePhoneForStorage } from '@/src/utils/phone';
import { sendMyBookingsOtp } from '@/lib/my-bookings-otp';
// Legacy: Twilio Verify SMS
// import { toE164, isValidPhone } from '@/lib/twilio-sms';
// import { checkRateLimit } from '@/lib/otp-service';
// import { sendVerification } from '@/lib/twilio-verify';

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const phoneNorm = normalizeInviteePhoneForStorage(phone);
    if (phoneNorm.invalid || !phoneNorm.value) {
      return NextResponse.json(
        { error: 'Valid phone number is required' },
        { status: 400 }
      );
    }
    const phoneE164 = phoneNorm.value;

    // Legacy: Twilio Verify SMS
    // if (!isValidPhone(phone)) {
    //   return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    // }
    // const phoneE164 = toE164(phone);
    // if (!phoneE164) {
    //   return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    // }
    // const canSend = await checkRateLimit(phoneE164, 3, 15);
    // if (!canSend) {
    //   return NextResponse.json(
    //     { error: 'Too many requests. Please try again later.' },
    //     { status: 429 }
    //   );
    // }
    // const sent = await sendVerification(phoneE164);
    // if (!sent) {
    //   return NextResponse.json(
    //     { error: 'Failed to send verification code. Please try again.' },
    //     { status: 500 }
    //   );
    // }
    // return NextResponse.json({ success: true });

    const result = await sendMyBookingsOtp(phoneE164);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      ...(result.email_hint ? { email_hint: result.email_hint } : {}),
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[my-bookings/send-otp] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
