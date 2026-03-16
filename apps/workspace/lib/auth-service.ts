import { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'crypto';

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

/**
 * Create a session for a user using temporary password flow
 */
export async function createUserSession(
  params: CreateSessionParams
): Promise<{ data: SessionResult | null; error: string | null }> {
  const { email, userId, supabaseAdmin, supabaseClient } = params;

  try {
    // Generate temporary password
    const tempPassword = `temp_${Date.now()}_${randomBytes(16).toString('hex')}`;

    // Update user with temporary password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (updateError) {
      console.error('Failed to set temporary password:', updateError);
      return { data: null, error: 'Failed to create session' };
    }

    // Sign in with temporary password
    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password: tempPassword,
    });

    if (signInError || !signInData.session) {
      console.error('Sign in error:', signInError);
      return { data: null, error: 'Failed to create session' };
    }

    return {
      data: {
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token ?? '',
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
  supabaseAdmin: SupabaseClient;
}

/**
 * Save Google Calendar integration (workspace-scoped schema)
 */
export async function saveGoogleCalendarIntegration(
  params: SaveGoogleIntegrationParams
): Promise<{ error: string | null }> {
  const { workspaceId, accessToken, refreshToken, expiresAt, scope, email, googleId, supabaseAdmin } = params;

  try {
    const credentials = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt != null ? Math.floor(expiresAt / 1000) : undefined,
    };
    const config = { scope, email };

    const { data: existing } = await supabaseAdmin
      .from('integrations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'google_calendar')
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from('integrations')
        .update({ provider_user_id: googleId ?? null, credentials, config })
        .eq('id', existing.id);

      if (error) {
        console.warn('Failed to save Google Calendar integration:', error);
        return { error: 'Failed to save calendar integration' };
      }
    } else {
      const { error } = await supabaseAdmin.from('integrations').insert({
        workspace_id: workspaceId,
        provider: 'google_calendar',
        provider_user_id: googleId ?? null,
        credentials,
        config,
      });

      if (error) {
        console.warn('Failed to save Google Calendar integration:', error);
        return { error: 'Failed to save calendar integration' };
      }
    }

    return { error: null };
  } catch (err) {
    console.error('saveGoogleCalendarIntegration error:', err);
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
