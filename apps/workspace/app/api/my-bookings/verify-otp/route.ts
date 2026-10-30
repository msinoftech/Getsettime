import { NextRequest, NextResponse } from 'next/server';
import { normalizeInviteePhoneForStorage } from '@/src/utils/phone';
import { verifyMyBookingsOtpAndCreateSession } from '@/lib/my-bookings-otp';
// Legacy: Twilio Verify
// import { toE164, isValidPhone } from '@/lib/twilio-sms';
// import { checkVerification } from '@/lib/twilio-verify';
// import { createSupabaseServerClient } from '@app/db';

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const codeRaw = typeof code === 'string' ? code.trim() : '';
    if (!codeRaw || codeRaw.length !== 6 || !/^\d{6}$/.test(codeRaw)) {
      return NextResponse.json(
        { error: 'Enter a valid 6-digit code' },
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

    // Legacy: Twilio Verify
    // if (!code || typeof code !== 'string') {
    //   return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
    // }
    // if (!isValidPhone(phone)) {
    //   return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    // }
    // const phoneE164 = toE164(phone);
    // if (!phoneE164) {
    //   return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    // }
    // const approved = await checkVerification(phoneE164, code);
    // if (!approved) {
    //   return NextResponse.json(
    //     { error: 'Invalid or expired verification code' },
    //     { status: 400 }
    //   );
    // }
    // const supabase = createSupabaseServerClient();
    // await supabase.from('phone_verification_sessions').delete().eq('phone_e164', phoneE164);
    // const { data, error } = await supabase
    //   .from('phone_verification_sessions')
    //   .insert({ phone_e164: phoneE164 })
    //   .select('token')
    //   .single();
    // ...

    const result = await verifyMyBookingsOtpAndCreateSession(phoneE164, codeRaw);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, lockout: result.lockout === true },
        { status: result.lockout ? 429 : 400 }
      );
    }

    return NextResponse.json({ success: true, token: result.token });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[my-bookings/verify-otp] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
