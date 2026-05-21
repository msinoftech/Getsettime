import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGoogleOAuthClient } from '@/lib/googleClient';
import { saveIntegration } from '@/lib/integrations';
import { updateUserGoogleMetadata } from '@/lib/auth-service';
import { getAuthFromRequest } from '@/lib/auth-helpers';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors from Google
    if (error) {
      console.error('Google OAuth error:', error, errorDescription);
      const errorMessage = errorDescription || error;
      return NextResponse.redirect(
        new URL(`/integrations?error=oauth_error&message=${encodeURIComponent(errorMessage)}`, req.url)
      );
    }

    if (!code || !state) {
      console.error('Missing OAuth parameters:', { code: !!code, state: !!state });
      return NextResponse.redirect(new URL('/integrations?error=missing_params', req.url));
    }

    let auth = await getAuthFromRequest(req);
    let stateLinkedAuthUserId: string | null | undefined;
    let stateReturnTo: string | undefined;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString()) as {
        userId?: string;
        workspaceId?: number;
        linkedAuthUserId?: string | null;
        returnTo?: string;
      };
      stateLinkedAuthUserId = decoded.linkedAuthUserId ?? null;
      stateReturnTo =
        typeof decoded.returnTo === 'string' && decoded.returnTo.startsWith('/')
          ? decoded.returnTo
          : undefined;
      if (!auth?.userId && decoded?.userId) {
        auth = {
          userId: decoded.userId,
          workspaceId: decoded.workspaceId != null ? Number(decoded.workspaceId) : null,
        };
      }
    } catch {
      if (!auth?.userId) {
        auth = { userId: state, workspaceId: null };
      }
    }
    if (!auth?.userId) {
      console.error('No user found');
      return NextResponse.redirect(new URL('/integrations?error=unauthorized', req.url));
    }
    if (!auth.workspaceId) {
      const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
      const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data } = await supabaseAdmin.auth.admin.getUserById(auth.userId);
        const wid = data?.user?.user_metadata?.workspace_id;
        if (wid != null) auth.workspaceId = Number(wid);
      }
    }
    if (!auth.workspaceId) {
      console.error('No workspace found');
      return NextResponse.redirect(new URL('/integrations?error=no_workspace', req.url));
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const supabaseAdmin =
      supabaseUrl && supabaseServiceKey
        ? createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : null;

    // Construct redirect URI dynamically (must match the one used in connect route)
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUri = `${baseUrl}/api/integrations/google/callback`;

    // Validate environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Google OAuth credentials not configured');
      return NextResponse.redirect(new URL('/integrations?error=config_missing', req.url));
    }

    const oauth2Client = getGoogleOAuthClient(redirectUri);

    try {
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token) {
        console.error('No access token received from Google');
        return NextResponse.redirect(new URL('/integrations?error=no_token', req.url));
      }

      // Fetch user info from Google (same as registration flow)
      let googleEmail: string | undefined;
      let googleId: string | undefined;
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (userInfoRes.ok) {
          const userInfo = await userInfoRes.json();
          googleEmail = userInfo.email;
          googleId = userInfo.id;
        }
      } catch {
        // Non-critical; integration will still be saved
      }

      const metadata = { scope: tokens.scope, email: googleEmail };

      let linkedAuthUserId = stateLinkedAuthUserId ?? null;
      if (linkedAuthUserId == null && supabaseAdmin) {
        const { data: roleRow } = await supabaseAdmin.auth.admin.getUserById(auth.userId);
        const role = roleRow?.user?.user_metadata?.role as string | undefined;
        if (role === ROLE_SERVICE_PROVIDER) {
          linkedAuthUserId = auth.userId;
        }
      }

      const result = await saveIntegration({
        workspace_id: auth.workspaceId,
        type: 'google_calendar',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
        metadata,
        provider_user_id: googleId,
        linked_auth_user_id: linkedAuthUserId,
      });

      if (!result.ok) {
        console.error('Failed to save integration:', result.error);
        const errParam = result.error ? `&message=${encodeURIComponent(result.error)}` : '';
        return NextResponse.redirect(new URL(`/integrations?error=save_failed${errParam}`, req.url));
      }

      if (supabaseAdmin) {
        await updateUserGoogleMetadata({
          userId: auth.userId,
          google_calendar_sync: true,
          google_id: googleId,
          google_email: googleEmail,
          supabaseAdmin,
        });
      }

      console.log('Google Calendar connected successfully for workspace:', auth.workspaceId);
      const successUrl = stateReturnTo
        ? stateReturnTo
        : '/integrations?success=google_connected';
      return NextResponse.redirect(new URL(successUrl, req.url));
    } catch (tokenError: any) {
      console.error('Error exchanging code for token:', tokenError);
      // Check for specific Google OAuth errors
      if (tokenError.message?.includes('redirect_uri_mismatch')) {
        console.error('Redirect URI mismatch. Expected:', redirectUri);
        return NextResponse.redirect(
          new URL('/integrations?error=redirect_uri_mismatch', req.url)
        );
      }
      throw tokenError;
    }
  } catch (error: any) {
    console.error('Google callback error:', error);
    const errorMessage = error.message || 'Unknown error occurred';
    return NextResponse.redirect(
      new URL(`/integrations?error=callback_failed&message=${encodeURIComponent(errorMessage)}`, req.url)
    );
  }
}

