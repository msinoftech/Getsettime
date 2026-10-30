import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/googleClient';
import {
  processGoogleAuthHandoff,
  type GoogleSignupData,
} from '@/lib/google-auth-handoff';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      console.error('Google OAuth error:', error, errorDescription);
      const errorMessage = errorDescription || error;

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

    let state: {
      enableCalendarSync?: boolean;
      isSignup?: boolean;
      timestamp?: number;
      returnTo?: string;
      claimCode?: string;
    } = {};
    if (stateParam) {
      try {
        state = JSON.parse(Buffer.from(stateParam, 'base64').toString());
      } catch (e) {
        console.error('Failed to decode state:', e);
      }
    }

    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

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

      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user info from Google');
      }

      const userInfo = await userInfoResponse.json();

      const hasCalendarScope =
        tokens.scope?.includes('https://www.googleapis.com/auth/calendar') || false;
      const enableCalendarSync = state.enableCalendarSync === true && hasCalendarScope;

      const handoffData: GoogleSignupData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? undefined,
        id_token: tokens.id_token,
        expires_at: tokens.expiry_date ?? undefined,
        scope: tokens.scope ?? undefined,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        google_id: userInfo.id,
        enableCalendarSync,
        isSignup: state.isSignup === true,
        claimCode: typeof state.claimCode === 'string' ? state.claimCode : null,
      };

      const handoffUrl = new URL(req.url);
      if (state.returnTo) {
        handoffUrl.searchParams.set('returnTo', state.returnTo);
      } else {
        handoffUrl.searchParams.delete('returnTo');
      }

      return processGoogleAuthHandoff(new Request(handoffUrl.toString()), handoffData);
    } catch (tokenError: unknown) {
      console.error('Error exchanging code for token:', tokenError);
      const redirectPath = state.isSignup ? '/register' : '/login';
      const message =
        tokenError instanceof Error ? tokenError.message : 'oauth_failed';

      if (message.includes('redirect_uri_mismatch')) {
        return NextResponse.redirect(
          new URL(`${redirectPath}?error=redirect_uri_mismatch`, req.url)
        );
      }

      return NextResponse.redirect(
        new URL(`${redirectPath}?error=${encodeURIComponent(message)}`, req.url)
      );
    }
  } catch (error: unknown) {
    console.error('Google callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, req.url)
    );
  }
}
