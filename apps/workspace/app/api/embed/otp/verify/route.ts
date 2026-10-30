import { NextRequest, NextResponse } from 'next/server';
import { normalizeInviteePhoneForStorage } from '@/src/utils/phone';
import {
  assertWorkspaceExists,
  normalizeEmbedOtpEmail,
  verifyEmbedBookingOtpAndIssueToken,
} from '@/lib/embed-booking-otp';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspace_id = body.workspace_id;
    const phoneRaw = typeof body.phone === 'string' ? body.phone : '';
    const emailRaw = typeof body.email === 'string' ? body.email : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    if (!(await assertWorkspaceExists(workspace_id))) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter a valid 6-digit code' }, { status: 400 });
    }

    const email = normalizeEmbedOtpEmail(emailRaw);
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const phoneNorm = normalizeInviteePhoneForStorage(phoneRaw);
    if (phoneNorm.invalid || !phoneNorm.value) {
      return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 });
    }

    const result = await verifyEmbedBookingOtpAndIssueToken(
      workspace_id,
      phoneNorm.value,
      email,
      code
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, lockout: result.lockout === true },
        { status: result.lockout ? 429 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verification_token: result.verification_token,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error verifying embed booking OTP:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
