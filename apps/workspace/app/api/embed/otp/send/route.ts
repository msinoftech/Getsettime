import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { normalizeInviteePhoneForStorage } from '@/src/utils/phone';
import {
  assertWorkspaceExists,
  checkRateLimit,
  deliverEmbedBookingOtp,
  embedOtpIdentifier,
  generateEmbedBookingOtpCode,
  getEmbedOtpLockout,
  normalizeEmbedOtpEmail,
  storeEmbedBookingOtp,
} from '@/lib/embed-booking-otp';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspace_id = body.workspace_id;
    const phoneRaw = typeof body.phone === 'string' ? body.phone : '';
    const emailRaw = typeof body.email === 'string' ? body.email : '';
    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    if (!(await assertWorkspaceExists(workspace_id))) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const email = normalizeEmbedOtpEmail(emailRaw);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const phoneNorm = normalizeInviteePhoneForStorage(phoneRaw);
    if (phoneNorm.invalid || !phoneNorm.value) {
      return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 });
    }
    const phoneE164 = phoneNorm.value;

    const lockout = await getEmbedOtpLockout(workspace_id, phoneE164);
    if (lockout.locked) {
      return NextResponse.json({ error: lockout.message }, { status: 429 });
    }

    const identifier = embedOtpIdentifier(workspace_id, phoneE164);
    const canSend = await checkRateLimit(identifier, 3, 15);
    if (!canSend) {
      return NextResponse.json(
        { error: 'Too many verification requests. Please try again later.' },
        { status: 429 }
      );
    }

    const otp = generateEmbedBookingOtpCode();
    const stored = await storeEmbedBookingOtp(identifier, otp, {
      invitee_email_normalized: email,
      invitee_phone_e164: phoneE164,
    });
    if (!stored) {
      return NextResponse.json(
        { error: 'Failed to send verification code. Please try again.' },
        { status: 500 }
      );
    }

    const delivery = await deliverEmbedBookingOtp({
      email,
      phoneE164,
      code: otp,
    });

    if (!delivery.email && !delivery.whatsapp) {
      await createSupabaseServerClient()
        .from('otp_verifications')
        .delete()
        .eq('identifier', identifier);
      return NextResponse.json(
        { error: 'Failed to send verification code. Please try again.' },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Embed booking OTP generated for ${identifier} (not exposed to client)`);
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your WhatsApp and email',
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error sending embed booking OTP:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
