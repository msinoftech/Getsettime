import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/googleClient';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { enableCalendarSync, isSignup, returnTo } = body;

    // Validate environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.' },
        { status: 500 }
      );
    }

    // Construct redirect URI dynamically from request URL
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    const oauth2Client = getGoogleOAuthClient(redirectUri);

    // Base scopes (always requested)
    const scopes = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    // Add calendar scope only if user enabled calendar sync
    if (enableCalendarSync === true) {
      scopes.push('https://www.googleapis.com/auth/calendar');
    }

    const state = JSON.stringify({
      enableCalendarSync: enableCalendarSync === true,
      isSignup: isSignup === true,
      timestamp: Date.now(),
      ...(typeof returnTo === 'string' && returnTo ? { returnTo } : {}),
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      scope: scopes,
      prompt: isSignup ? 'consent' : 'select_account', // Force consent on signup
      state: Buffer.from(state).toString('base64'), // Encode state
      include_granted_scopes: true,
    });

    return NextResponse.json({ authUrl });
  } catch (error: any) {
    console.error('Google OAuth error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
