import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/googleClient';
import { getAuthFromRequest } from '@/lib/auth-helpers';

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req);

    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!auth.workspaceId) {
      return NextResponse.json(
        { error: 'Workspace not found. Please complete onboarding first.' },
        { status: 400 }
      );
    }

    // Construct redirect URI dynamically from request URL
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUri = `${baseUrl}/api/integrations/google/callback`;

    // Validate environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Google OAuth credentials not configured');
      return NextResponse.json(
        { error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.' },
        { status: 500 }
      );
    }

    const oauth2Client = getGoogleOAuthClient(redirectUri);
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    const state = Buffer.from(JSON.stringify({ userId: auth.userId, workspaceId: auth.workspaceId })).toString('base64');

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state,
      include_granted_scopes: true,
    });

    console.log('Generated Google OAuth URL with redirect URI:', redirectUri);
    return NextResponse.json({ authUrl });
  } catch (error: any) {
    console.error('Google OAuth error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}

