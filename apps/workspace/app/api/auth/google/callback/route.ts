import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/googleClient';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors from Google
    if (error) {
      console.error('Google OAuth error:', error, errorDescription);
      const errorMessage = errorDescription || error;
      
      // Redirect to appropriate page based on error
      const state = stateParam ? JSON.parse(Buffer.from(stateParam, 'base64').toString()) : null;
      const isSignup = state?.isSignup === true;
      const redirectPath = isSignup ? '/register' : '/login';
      
      return NextResponse.redirect(
        new URL(`${redirectPath}?error=${encodeURIComponent(errorMessage)}`, req.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=missing_code', req.url));
    }

    let state: { enableCalendarSync?: boolean; isSignup?: boolean; timestamp?: number; returnTo?: string } = {};
    if (stateParam) {
      try {
        state = JSON.parse(Buffer.from(stateParam, 'base64').toString());
      } catch (e) {
        console.error('Failed to decode state:', e);
      }
    }

    // Construct redirect URI (must match the one used in auth route)
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    // Validate environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.redirect(new URL('/login?error=config_missing', req.url));
    }

    const oauth2Client = getGoogleOAuthClient(redirectUri);

    try {
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token || !tokens.id_token) {
        console.error('No access token or ID token received from Google');
        const redirectPath = state.isSignup ? '/register' : '/login';
        return NextResponse.redirect(new URL(`${redirectPath}?error=no_token`, req.url));
      }

      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user info from Google');
      }

      const userInfo = await userInfoResponse.json();

      // Check if calendar scope was granted
      const hasCalendarScope = tokens.scope?.includes('https://www.googleapis.com/auth/calendar') || false;
      const enableCalendarSync = state.enableCalendarSync === true && hasCalendarScope;

      const callbackUrl = new URL('/api/auth/google/signup', req.url);
      callbackUrl.searchParams.set('code', Buffer.from(JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        id_token: tokens.id_token,
        expires_at: tokens.expiry_date,
        scope: tokens.scope,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        google_id: userInfo.id,
        enableCalendarSync,
        isSignup: state.isSignup === true,
      })).toString('base64'));
      if (state.returnTo) {
        callbackUrl.searchParams.set('returnTo', state.returnTo);
      }

      return NextResponse.redirect(callbackUrl.toString());
    } catch (tokenError: any) {
      console.error('Error exchanging code for token:', tokenError);
      const redirectPath = state.isSignup ? '/register' : '/login';
      
      if (tokenError.message?.includes('redirect_uri_mismatch')) {
        return NextResponse.redirect(
          new URL(`${redirectPath}?error=redirect_uri_mismatch`, req.url)
        );
      }
      
      return NextResponse.redirect(
        new URL(`${redirectPath}?error=${encodeURIComponent(tokenError.message || 'oauth_failed')}`, req.url)
      );
    }
  } catch (error: any) {
    console.error('Google callback error:', error);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message || 'Unknown error occurred')}`, req.url)
    );
  }
}
