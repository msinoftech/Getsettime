import { NextRequest, NextResponse } from 'next/server';
import {
  storeOTP,
  checkRateLimit,
  sendOTPEmail,
  sendOTPSMS,
} from '@/lib/otp-service';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, email } = body;

    if (!phone && !email) {
      return NextResponse.json(
        { error: 'Phone or email is required' },
        { status: 400 }
      );
    }

    const identifier = phone ? normalizePhone(phone) : normalizeEmail(email);
    const type = phone ? 'phone' : 'email';

    // Check rate limit (using database)
    const canSend = await checkRateLimit(identifier, 3, 15);
    if (!canSend) {
      return NextResponse.json(
        {
          error: 'Too many OTP requests. Please try again later.',
        },
        { status: 429 }
      );
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP in database
    const stored = await storeOTP(identifier, otp, type);
    if (!stored) {
      return NextResponse.json(
        { error: 'Failed to generate OTP. Please try again.' },
        { status: 500 }
      );
    }

    // Send OTP via email or SMS
    let sent = false;
    if (type === 'phone') {
      sent = await sendOTPSMS(phone, otp);
    } else {
      sent = await sendOTPEmail(email, otp);
    }

    if (!sent) {
      // OTP stored but failed to send - still return success in dev mode
      const isDev = process.env.NODE_ENV === 'development';
      if (!isDev) {
        return NextResponse.json(
          { error: 'Failed to send OTP. Please try again.' },
          { status: 500 }
        );
      }
    }

    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json({
      success: true,
      message: `OTP sent to your ${type}`,
      // Only return OTP in development mode for testing
      ...(isDev && { otp }),
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error sending OTP:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}


