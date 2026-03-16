import { NextRequest, NextResponse } from 'next/server';
import { toE164, isValidPhone } from '@/lib/twilio-sms';
import { checkVerification } from '@/lib/twilio-verify';
import { createSupabaseServerClient } from '@app/db';

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      );
    }

    const phoneE164 = toE164(phone);
    if (!phoneE164) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    const approved = await checkVerification(phoneE164, code);
    if (!approved) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();

    // Clean up any existing sessions for this phone before creating a new one
    await supabase
      .from('phone_verification_sessions')
      .delete()
      .eq('phone_e164', phoneE164);

    const { data, error } = await supabase
      .from('phone_verification_sessions')
      .insert({ phone_e164: phoneE164 })
      .select('token')
      .single();

    if (error || !data) {
      console.error('[my-bookings/verify-otp] Session creation failed:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });
      return NextResponse.json(
        { error: 'Failed to create session. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, token: data.token });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[my-bookings/verify-otp] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
