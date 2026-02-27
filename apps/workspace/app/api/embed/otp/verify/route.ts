import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP } from '@/lib/otp-service';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, email, code } = body;

    if (!code || (!phone && !email)) {
      return NextResponse.json(
        { error: 'Code and phone or email are required' },
        { status: 400 }
      );
    }

    const identifier = phone ? normalizePhone(phone) : normalizeEmail(email);

    // Verify OTP but don't delete it yet (will be deleted when booking is created)
    const isValid = await verifyOTP(identifier, code, false);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP code' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

