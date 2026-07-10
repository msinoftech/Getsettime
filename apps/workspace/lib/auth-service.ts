import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export interface CreateSessionParams {
  email: string;
  userId: string;
  supabaseAdmin: SupabaseClient;
  supabaseClient: SupabaseClient;
}

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
}

export interface RevokeOtherSessionsParams {
  accessToken: string;
  supabaseAdmin: SupabaseClient;
}

/**
 * Keep the current session and revoke all other sessions for the same user.
 * Uses admin signOut scope "others" — never "global".
 */
export async function revokeOtherSessions(
  params: RevokeOtherSessionsParams
): Promise<{ error: string | null }> {
  const { accessToken, supabaseAdmin } = params;

  try {
    const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, 'others');
    if (error) {
      console.warn('Failed to revoke other sessions:', error);
      return { error: error.message || 'Failed to revoke other sessions' };
    }
    return { error: null };
  } catch (err) {
    console.warn('revokeOtherSessions error:', err);
    return {
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Create a Supabase session without changing the user's password.
 * Uses admin-generated magic link + verifyOtp, then revokes other sessions.
 */
export async function createUserSession(
  params: CreateSessionParams
): Promise<{ data: SessionResult | null; error: string | null }> {
  const { email, supabaseAdmin, supabaseClient } = params;

  try {
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error('Failed to generate magic link for session:', linkError);
      return { data: null, error: 'Failed to create session' };
    }

    const { data: otpData, error: otpError } = await supabaseClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    });

    if (otpError || !otpData.session) {
      console.error('verifyOtp error:', otpError);
      return { data: null, error: 'Failed to create session' };
    }

    const accessToken = otpData.session.access_token;
    await revokeOtherSessions({ accessToken, supabaseAdmin });

    return {
      data: {
        accessToken,
        refreshToken: otpData.session.refresh_token ?? '',
      },
      error: null,
    };
  } catch (err) {
    console.error('createUserSession error:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export interface StoreCallbackTokenParams {
  accessToken: string;
  refreshToken: string;
  supabaseAdmin: SupabaseClient;
}

/**
 * Store callback tokens in database
 */
export async function storeCallbackToken(
  params: StoreCallbackTokenParams
): Promise<{ callbackId: string | null; error: string | null }> {
  const { accessToken, refreshToken, supabaseAdmin } = params;

  try {
    const callbackId = randomUUID();
    const { error: insertError } = await supabaseAdmin.from('auth_callback_tokens').insert({
      id: callbackId,
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (insertError) {
      console.error('Failed to store callback token:', insertError);
      return { callbackId: null, error: 'Failed to store callback token' };
    }

    return { callbackId, error: null };
  } catch (err) {
    console.error('storeCallbackToken error:', err);
    return {
      callbackId: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export interface UpdateUserGoogleMetadataParams {
  userId: string;
  google_calendar_sync: boolean;
  google_id?: string;
  google_email?: string;
  supabaseAdmin: SupabaseClient;
}

/**
 * Update user metadata with Google Calendar sync info (same as registration flow)
 */
export async function updateUserGoogleMetadata(
  params: UpdateUserGoogleMetadataParams
): Promise<{ error: string | null }> {
  const { userId, google_calendar_sync, google_id, google_email, supabaseAdmin } = params;

  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const existingMeta = (userData?.user?.user_metadata ?? {}) as Record<string, unknown>;

    const meta: Record<string, unknown> = {
      ...existingMeta,
      google_calendar_sync,
    };
    if (google_calendar_sync && google_id != null) meta.google_id = google_id;
    if (google_calendar_sync && google_email != null) meta.google_email = google_email;
    if (!google_calendar_sync) {
      delete meta.google_id;
      delete meta.google_email;
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: meta,
    });

    if (updateError) {
      console.warn('Failed to update user metadata:', updateError);
      return { error: 'Failed to update metadata' };
    }
    return { error: null };
  } catch (err) {
    console.error('updateUserGoogleMetadata error:', err);
    return {
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export interface SaveGoogleIntegrationParams {
  workspaceId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  scope?: string;
  email: string;
  googleId?: string;
  /** When set, stores integration for this service provider only (not workspace-level). */
  linkedAuthUserId?: string | null;
  supabaseAdmin: SupabaseClient;
}

/**
 * Save Google Calendar integration (workspace-level or per service-provider).
 */
export async function saveGoogleCalendarIntegration(
  params: SaveGoogleIntegrationParams
): Promise<{ error: string | null }> {
  const {
    workspaceId,
    accessToken,
    refreshToken,
    expiresAt,
    scope,
    email,
    googleId,
    linkedAuthUserId,
  } = params;

  const { saveIntegration } = await import('@/lib/integrations');

  const result = await saveIntegration({
    workspace_id: workspaceId,
    type: 'google_calendar',
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt != null ? Math.floor(expiresAt / 1000) : undefined,
    metadata: { scope, email },
    provider_user_id: googleId,
    linked_auth_user_id: linkedAuthUserId ?? null,
  });

  if (!result.ok) {
    return { error: result.error ?? 'Failed to save calendar integration' };
  }
  return { error: null };
}
