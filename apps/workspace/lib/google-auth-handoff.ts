import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  getOrCreateWorkspace,
  updateUserWorkspaceMetadata,
} from '@/lib/workspace-service';
import { sendWorkspaceWelcomeEmail } from '@/lib/send-workspace-welcome-email';
import {
  createUserSession,
  storeCallbackToken,
  saveGoogleCalendarIntegration,
} from '@/lib/auth-service';
import { findAuthUserByEmail, type AuthUserSnapshot } from '@/lib/auth-user-lookup';
import { workspaceAdminNeedsOnboardingWizard } from '@/lib/auth_onboarding';
import { getPublicSiteOrigin } from '@/lib/request-site-origin';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';
import { resolveRegistrationGeoFromHeaders } from '@/lib/ipapi-geo';
import {
  ClaimCodeError,
  consumeClaimCode,
  isEmailClaimIneligible,
  validateClaimCodeForSignup,
} from '@app/db/subscription';

export interface GoogleSignupData {
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
  claimCode?: string | null;
}

type SupabaseClients = {
  supabaseAdmin: SupabaseClient;
  supabaseClient: SupabaseClient;
};

function createSupabaseClients(): SupabaseClients | null {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return null;
  }

  return {
    supabaseAdmin: createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    supabaseClient: createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

function serverConfigRedirect(req: Request): NextResponse {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (typeof req.url === 'string' && req.url.startsWith('http') ? new URL(req.url).origin : '');
  const params = new URLSearchParams({ error: 'server_config' });
  return NextResponse.redirect(`${origin.replace(/\/$/, '')}/login?${params.toString()}`);
}

function redirectWithCallbackToken(
  req: Request,
  callbackId: string,
  nextPath: string
): NextResponse {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (typeof req.url === 'string' && req.url.startsWith('http')
      ? new URL(req.url).origin
      : '');
  const res = NextResponse.redirect(
    `${origin.replace(/\/$/, '')}/auth/callback?next=${encodeURIComponent(nextPath)}&t=${callbackId}`
  );
  res.cookies.set('sb_callback_t', callbackId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60,
  });
  return res;
}

async function finalizeAuthRedirect(
  req: Request,
  clients: SupabaseClients,
  params: {
    email: string;
    userId: string;
    nextPath: string;
  }
): Promise<NextResponse> {
  const { data: sessionData, error: sessionError } = await createUserSession({
    email: params.email,
    userId: params.userId,
    supabaseAdmin: clients.supabaseAdmin,
    supabaseClient: clients.supabaseClient,
  });

  if (sessionError || !sessionData) {
    console.error('Failed to create session:', sessionError);
    return NextResponse.redirect(new URL('/login?error=signin_failed', req.url));
  }

  const { callbackId, error: tokenError } = await storeCallbackToken({
    accessToken: sessionData.accessToken,
    refreshToken: sessionData.refreshToken,
    supabaseAdmin: clients.supabaseAdmin,
  });

  if (tokenError || !callbackId) {
    console.error('Failed to store callback token:', tokenError);
    return NextResponse.redirect(new URL('/login?error=signin_failed', req.url));
  }

  return redirectWithCallbackToken(req, callbackId, params.nextPath);
}

async function handleExistingUserLogin(
  req: Request,
  data: GoogleSignupData,
  clients: SupabaseClients,
  existingUser: AuthUserSnapshot
): Promise<NextResponse> {
  const { email, name, google_id, enableCalendarSync, access_token, refresh_token, expires_at } =
    data;

  const userId = existingUser.id;
  const existingMeta = existingUser.user_metadata ?? {};

  const { data: workspaceResult, error: workspaceError } = await getOrCreateWorkspace({
    userId,
    userName: name,
    userEmail: email,
    supabaseAdmin: clients.supabaseAdmin,
    userMetadata: existingMeta,
  });

  if (workspaceError || !workspaceResult) {
    console.error('Failed to get/create workspace for existing user:', workspaceError);
    return NextResponse.redirect(new URL('/login?error=workspace_error', req.url));
  }

  const metadataPatch: Record<string, unknown> = {
    google_calendar_sync: enableCalendarSync,
    google_id,
    picture: data.picture,
  };
  if (enableCalendarSync) {
    metadataPatch.google_email = email;
  }

  const { error: metaError, metadata: metaNow } = await updateUserWorkspaceMetadata(
    userId,
    workspaceResult.workspaceId,
    metadataPatch,
    clients.supabaseAdmin,
    false,
    existingMeta
  );

  if (metaError) {
    console.warn('Failed to update user metadata (non-critical):', metaError);
  }

  const role = typeof metaNow?.role === 'string' ? metaNow.role : undefined;
  const isServiceProvider = role === ROLE_SERVICE_PROVIDER;

  const [workspaceProfileResult] = await Promise.all([
    clients.supabaseAdmin
      .from('workspaces')
      .select('type, profession_id')
      .eq('id', workspaceResult.workspaceId)
      .maybeSingle(),
    enableCalendarSync && refresh_token
      ? saveGoogleCalendarIntegration({
          workspaceId: workspaceResult.workspaceId,
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: expires_at,
          scope: data.scope,
          email,
          googleId: data.google_id,
          linkedAuthUserId: isServiceProvider ? userId : null,
          supabaseAdmin: clients.supabaseAdmin,
        })
      : Promise.resolve(null),
  ]);

  const wsRow = workspaceProfileResult.data;
  const hasWorkspaceProfile = !!(wsRow?.type || wsRow?.profession_id);
  const needsOnboarding =
    role === 'workspace_admin' &&
    workspaceAdminNeedsOnboardingWizard(metaNow ?? existingMeta, hasWorkspaceProfile);

  const returnTo = req.url ? new URL(req.url).searchParams.get('returnTo') : null;
  let nextPath = returnTo && returnTo.startsWith('/') ? returnTo : '/';
  if (needsOnboarding) {
    nextPath = '/register?onboarding=1';
  }

  return finalizeAuthRedirect(req, clients, { email, userId, nextPath });
}

async function handleNewUserSignup(
  req: Request,
  data: GoogleSignupData,
  clients: SupabaseClients
): Promise<NextResponse> {
  const { email, name, google_id, enableCalendarSync, access_token, refresh_token, expires_at } =
    data;
  const claimCode =
    typeof data.claimCode === 'string' && data.claimCode.trim() ? data.claimCode.trim() : null;
  const isClaimSignup = Boolean(claimCode);

  if (claimCode) {
    const validation = await validateClaimCodeForSignup(clients.supabaseAdmin, claimCode);
    if (!validation.valid) {
      const q = new URLSearchParams({
        error: validation.message,
        claim_code: claimCode,
      });
      return NextResponse.redirect(new URL(`/register?${q.toString()}`, req.url));
    }
    if (await isEmailClaimIneligible(clients.supabaseAdmin, email)) {
      return NextResponse.redirect(
        new URL('/register?error=claim_invalid&claim_code=' + encodeURIComponent(claimCode), req.url)
      );
    }
  }

  const { data: userData, error: createError } = await clients.supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      name,
      signup_method: 'google',
      google_calendar_sync: enableCalendarSync,
      google_id,
      picture: data.picture,
      onboarding_completed: isClaimSignup ? false : true,
      onboarding_last_completed_step: isClaimSignup ? 0 : 4,
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

  let createdMeta = (userData.user.user_metadata ?? {}) as Record<string, unknown>;

  if (claimCode) {
    try {
      const claimedCodeId = await consumeClaimCode(
        clients.supabaseAdmin,
        claimCode,
        userId,
        email
      );
      const claimPatch = {
        claim_code: claimCode,
        claimed_code_id: claimedCodeId,
        signup_type: 'free_claimed',
      };
      await clients.supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { ...createdMeta, ...claimPatch },
      });
      createdMeta = { ...createdMeta, ...claimPatch };
    } catch (err) {
      await clients.supabaseAdmin.auth.admin.deleteUser(userId);
      const msg = err instanceof ClaimCodeError ? err.message : 'claim_invalid';
      return NextResponse.redirect(
        new URL(
          `/register?error=${encodeURIComponent(msg)}&claim_code=${encodeURIComponent(claimCode)}`,
          req.url
        )
      );
    }
  }

  const registrationGeo = await resolveRegistrationGeoFromHeaders(req.headers);

  const { data: workspaceResult, error: workspaceError } = await getOrCreateWorkspace({
    userId,
    userName: name,
    userEmail: email,
    supabaseAdmin: clients.supabaseAdmin,
    registrationGeo,
    userMetadata: createdMeta,
  });

  if (workspaceError || !workspaceResult) {
    console.error('Workspace creation error:', workspaceError);
    await clients.supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.redirect(new URL('/register?error=workspace_creation_failed', req.url));
  }

  const { error: metaError } = await updateUserWorkspaceMetadata(
    userId,
    workspaceResult.workspaceId,
    {
      name,
      signup_method: 'google',
      google_calendar_sync: enableCalendarSync,
      google_id,
      picture: data.picture,
      onboarding_completed: isClaimSignup ? false : true,
      onboarding_last_completed_step: isClaimSignup ? 0 : 4,
    },
    clients.supabaseAdmin,
    workspaceResult.isNewWorkspace,
    createdMeta
  );

  if (metaError) {
    console.error('Failed to update user metadata:', metaError);
    await clients.supabaseAdmin
      .from('configurations')
      .delete()
      .eq('workspace_id', workspaceResult.workspaceId);
    await clients.supabaseAdmin.from('workspaces').delete().eq('id', workspaceResult.workspaceId);
    await clients.supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.redirect(new URL('/register?error=user_update_failed', req.url));
  }

  if (workspaceResult.isNewWorkspace && email) {
    sendWorkspaceWelcomeEmail({
      to: email,
      workspaceId: workspaceResult.workspaceId,
      adminName: name,
      supabaseAdmin: clients.supabaseAdmin,
    }).catch((err) => console.error('Welcome email failed (non-critical):', err));
  }

  if (enableCalendarSync && refresh_token) {
    await saveGoogleCalendarIntegration({
      workspaceId: workspaceResult.workspaceId,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: expires_at,
      scope: data.scope,
      email,
      googleId: data.google_id,
      linkedAuthUserId: null,
      supabaseAdmin: clients.supabaseAdmin,
    });
  }

  const nextPath = isClaimSignup ? '/register?onboarding=1' : '/';

  return finalizeAuthRedirect(req, clients, {
    email,
    userId,
    nextPath,
  });
}

function redirectNoAccount(req: Request, email: string): NextResponse {
  const siteOrigin = getPublicSiteOrigin(req);
  const params = new URLSearchParams({ no_account: '1', email });
  const loginHref = siteOrigin
    ? `${siteOrigin}/login?${params.toString()}`
    : new URL(`/login?${params.toString()}`, req.url).toString();
  return NextResponse.redirect(loginHref);
}

/** Complete Google OAuth login/signup and redirect to /auth/callback with session handoff. */
export async function processGoogleAuthHandoff(
  req: Request,
  data: GoogleSignupData
): Promise<NextResponse> {
  if (!data.email || !data.name || !data.google_id) {
    return NextResponse.redirect(new URL('/login?error=missing_user_data', req.url));
  }

  const clients = createSupabaseClients();
  if (!clients) {
    return serverConfigRedirect(req);
  }

  const existingUser = await findAuthUserByEmail(clients.supabaseAdmin, data.email);

  if (existingUser) {
    return handleExistingUserLogin(req, data, clients, existingUser);
  }

  if (data.isSignup) {
    return handleNewUserSignup(req, data, clients);
  }

  return redirectNoAccount(req, data.email);
}
