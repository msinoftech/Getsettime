import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getOrCreateWorkspace,
  updateUserWorkspaceMetadata,
} from '@/lib/workspace-service';
import {
  createUserSession,
  storeCallbackToken,
  saveGoogleCalendarIntegration,
} from '@/lib/auth-service';

interface GoogleSignupData {
  access_token: string;
  refresh_token?: string;
  id_token: string;
  expires_at?: number;
  scope?: string;
  email: string;
  name: string;
  picture?: string;
  google_id: string;
  enableCalendarSync: boolean;
  isSignup: boolean;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=missing_data', req.url));
    }

    // Decode the data
    let data: GoogleSignupData;
    try {
      data = JSON.parse(Buffer.from(code, 'base64').toString());
    } catch (e) {
      return NextResponse.redirect(new URL('/login?error=invalid_data', req.url));
    }

    const {
      email,
      name,
      google_id,
      enableCalendarSync,
      isSignup,
      access_token,
      refresh_token,
      id_token,
      expires_at,
    } = data;

    if (!email || !name || !google_id) {
      return NextResponse.redirect(new URL('/login?error=missing_user_data', req.url));
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '').trim();

    const missing: string[] = [];
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');

    if (missing.length > 0) {
      const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || (typeof req.url === 'string' && req.url.startsWith('http') ? new URL(req.url).origin : null) || 'http://localhost:3001';
      const params = new URLSearchParams({ error: 'server_config', hint: missing.join(',') });
      return NextResponse.redirect(`${origin.replace(/\/$/, '')}/login?${params.toString()}`);
    }

    // Use service role client for admin operations (use resolved env vars so either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_* works)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user already exists (listUsers + find by email; no getUserByEmail in Supabase Auth)
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 });
    const found = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    const existingUser = found ? { user: found } : null;

    if (existingUser?.user) {
      // Existing user - login flow
      const userId = existingUser.user.id;

      // Ensure workspace exists for user (get or create)
      const { data: workspaceResult, error: workspaceError } = await getOrCreateWorkspace({
        userId,
        userName: name,
        userEmail: email,
        supabaseAdmin,
      });

      if (workspaceError || !workspaceResult) {
        console.error('Failed to get/create workspace for existing user:', workspaceError);
        return NextResponse.redirect(new URL('/login?error=workspace_error', req.url));
      }

      // Update user metadata with workspace and calendar sync settings
      const { error: metaError } = await updateUserWorkspaceMetadata(
        userId,
        workspaceResult.workspaceId,
        {
          google_calendar_sync: enableCalendarSync,
          google_id,
          picture: data.picture,
        },
        supabaseAdmin
      );

      if (metaError) {
        console.warn('Failed to update user metadata (non-critical):', metaError);
      }

      // Save Google Calendar integration if enabled
      if (enableCalendarSync && refresh_token) {
        await saveGoogleCalendarIntegration({
          workspaceId: workspaceResult.workspaceId,
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: expires_at,
          scope: data.scope,
          email,
          googleId: data.google_id,
          supabaseAdmin,
        });
      }

      // Create session
      const { data: sessionData, error: sessionError } = await createUserSession({
        email,
        userId,
        supabaseAdmin,
        supabaseClient,
      });

      if (sessionError || !sessionData) {
        console.error('Failed to create session for existing user:', sessionError);
        return NextResponse.redirect(new URL('/login?error=signin_failed', req.url));
      }

      // Store callback token
      const { callbackId, error: tokenError } = await storeCallbackToken({
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken,
        supabaseAdmin,
      });

      if (tokenError || !callbackId) {
        console.error('Failed to store callback token:', tokenError);
        return NextResponse.redirect(new URL('/login?error=signin_failed', req.url));
      }

      // Redirect to callback
      const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || (typeof req.url === 'string' && req.url.startsWith('http') ? new URL(req.url).origin : 'http://localhost:3001');
      const returnTo = req.url ? new URL(req.url).searchParams.get('returnTo') : null;
      const nextPath = returnTo && returnTo.startsWith('/') ? returnTo : '/';
      const res = NextResponse.redirect(`${origin.replace(/\/$/, '')}/auth/callback?next=${encodeURIComponent(nextPath)}&t=${callbackId}`);
      res.cookies.set('sb_callback_t', callbackId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 });
      return res;
    }
    if (isSignup) {
      // New user - signup flow
      // Create user first using admin API
      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true, // Auto-confirm email for OAuth users
        user_metadata: {
          name,
          signup_method: 'google',
          google_calendar_sync: enableCalendarSync,
          google_id,
          picture: data.picture,
        },
      });

      if (createError || !userData.user) {
        console.error('User creation error:', createError);
        const errorMsg = createError?.message || '';
        if (errorMsg.includes('already') || errorMsg.includes('exists')) {
          return NextResponse.redirect(new URL('/login?error=user_already_exists', req.url));
        }
        return NextResponse.redirect(new URL('/register?error=user_creation_failed', req.url));
      }

      const userId = userData.user.id;

      // Create workspace for the new user
      const { data: workspaceResult, error: workspaceError } = await getOrCreateWorkspace({
        userId,
        userName: name,
        userEmail: email,
        supabaseAdmin,
      });

      if (workspaceError || !workspaceResult) {
        console.error('Workspace creation error:', workspaceError);
        // Clean up user if workspace creation failed
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.redirect(new URL('/register?error=workspace_creation_failed', req.url));
      }

      // Update user metadata with workspace information
      const { error: metaError } = await updateUserWorkspaceMetadata(
        userId,
        workspaceResult.workspaceId,
        {
          name,
          signup_method: 'google',
          google_calendar_sync: enableCalendarSync,
          google_id,
          picture: data.picture,
        },
        supabaseAdmin
      );

      if (metaError) {
        console.error('Failed to update user metadata:', metaError);
        // Clean up workspace and user
        await supabaseAdmin.from('configurations').delete().eq('workspace_id', workspaceResult.workspaceId);
        await supabaseAdmin.from('workspaces').delete().eq('id', workspaceResult.workspaceId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.redirect(new URL('/register?error=user_update_failed', req.url));
      }

      // Save Google Calendar integration if enabled
      if (enableCalendarSync && refresh_token) {
        await saveGoogleCalendarIntegration({
          workspaceId: workspaceResult.workspaceId,
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: expires_at,
          scope: data.scope,
          email,
          googleId: data.google_id,
          supabaseAdmin,
        });
      }

      // Create session
      const { data: sessionData, error: sessionError } = await createUserSession({
        email,
        userId,
        supabaseAdmin,
        supabaseClient,
      });

      if (sessionError || !sessionData) {
        console.error('Failed to create session for new user:', sessionError);
        return NextResponse.redirect(new URL('/login?message=account_created_please_signin', req.url));
      }

      // Store callback token
      const { callbackId, error: tokenError } = await storeCallbackToken({
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken,
        supabaseAdmin,
      });

      if (tokenError || !callbackId) {
        console.error('Failed to store callback token:', tokenError);
        return NextResponse.redirect(new URL('/login?message=account_created_please_signin', req.url));
      }

      // Redirect to onboarding
      const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || (typeof req.url === 'string' && req.url.startsWith('http') ? new URL(req.url).origin : 'http://localhost:3001');
      const onboardingNext = encodeURIComponent('/register?onboarding=1');
      const res = NextResponse.redirect(`${origin.replace(/\/$/, '')}/auth/callback?next=${onboardingNext}&t=${callbackId}`);
      res.cookies.set('sb_callback_t', callbackId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 });
      return res;
    } else {
      // User doesn't exist and this is a login attempt
      return NextResponse.redirect(new URL('/register?error=user_not_found', req.url));
    }
  } catch (error: any) {
    console.error('Google signup error:', error);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message || 'Unknown error occurred')}`, req.url)
    );
  }
}
