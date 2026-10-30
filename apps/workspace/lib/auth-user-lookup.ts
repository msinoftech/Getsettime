import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthUserSnapshot = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
};

type RpcAuthUserRow = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function rowToSnapshot(row: RpcAuthUserRow): AuthUserSnapshot {
  return {
    id: row.id,
    email: row.email ?? undefined,
    email_confirmed_at: row.email_confirmed_at ?? null,
    user_metadata:
      row.user_metadata && typeof row.user_metadata === 'object'
        ? (row.user_metadata as Record<string, unknown>)
        : {},
  };
}

function isMissingRpcError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('get_auth_user_by_email') ||
    lower.includes('could not find the function') ||
    lower.includes('schema cache')
  );
}

/** Indexed email lookup via RPC; falls back to listUsers page 1 when migration is not applied. */
export async function findAuthUserByEmail(
  supabaseAdmin: SupabaseClient,
  email: string
): Promise<AuthUserSnapshot | null> {
  const normalized = email.trim();
  if (!normalized) return null;

  const { data, error } = await supabaseAdmin.rpc('get_auth_user_by_email', {
    lookup_email: normalized,
  });

  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    if (row && typeof row === 'object' && 'id' in row) {
      return rowToSnapshot(row as RpcAuthUserRow);
    }
    return null;
  }

  if (!isMissingRpcError(error.message)) {
    console.error('findAuthUserByEmail RPC error:', error);
    return null;
  }

  console.warn(
    'findAuthUserByEmail: RPC missing, falling back to listUsers (apply create_get_auth_user_by_email_rpc migration)'
  );
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
    page: 1,
  });
  const found = listData?.users?.find(
    (u) => u.email?.toLowerCase() === normalized.toLowerCase()
  );
  if (!found) return null;

  return {
    id: found.id,
    email: found.email,
    email_confirmed_at: found.email_confirmed_at ?? null,
    user_metadata: (found.user_metadata ?? {}) as Record<string, unknown>,
  };
}

/** Whether an auth account exists for this email. */
export async function isAuthEmailRegistered(
  supabaseAdmin: SupabaseClient,
  email: string
): Promise<boolean> {
  const user = await findAuthUserByEmail(supabaseAdmin, email);
  return user != null;
}
