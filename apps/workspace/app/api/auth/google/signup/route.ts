import { NextResponse } from 'next/server';
import {
  processGoogleAuthHandoff,
  type GoogleSignupData,
} from '@/lib/google-auth-handoff';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=missing_data', req.url));
    }

    let data: GoogleSignupData;
    try {
      data = JSON.parse(Buffer.from(code, 'base64').toString());
    } catch {
      return NextResponse.redirect(new URL('/login?error=invalid_data', req.url));
    }

    return processGoogleAuthHandoff(req, data);
  } catch (error: unknown) {
    console.error('Google signup error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, req.url)
    );
  }
}
