'use client';

import type { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

let cachedSession: Session | null = null;

/** Chains Supabase auth storage operations so only one holds the Navigator lock at a time. */
let authChain: Promise<unknown> = Promise.resolve();

function isLockAcquireError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name ?? '';
  const message = (err as { message?: string }).message ?? '';
  return (
    name.includes('LockAcquireTimeout') ||
    message.includes('LockManager lock') ||
    message.includes('immediately failed')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function runSerializedAuth<T>(operation: () => Promise<T>): Promise<T> {
  const next = authChain.then(operation, operation);
  authChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function withLockRetry<T>(operation: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (!isLockAcquireError(err) || i >= attempts - 1) throw err;
      await sleep(40 * (i + 1));
    }
  }
  throw lastError;
}

/** Called by AuthProvider whenever Supabase auth state changes. */
export function syncAuthSessionCache(session: Session | null): void {
  cachedSession = session;
}

export function clearAuthSessionCache(): void {
  cachedSession = null;
}

export function getCachedSession(): Session | null {
  return cachedSession;
}

export function getCachedAccessToken(): string | null {
  return cachedSession?.access_token ?? null;
}

/** Sync Bearer headers when the in-memory session cache is warm. */
export function getCachedAuthHeaders(): Record<string, string> | null {
  const token = getCachedAccessToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

export type WorkspaceSessionResult = {
  session: Session | null;
  error: AuthError | null;
};

type WorkspaceSessionOptions = {
  /** Read from Supabase storage even when the in-memory cache is warm (e.g. after refreshSession). */
  bypassCache?: boolean;
};

/** Prefer in-memory session; fall back to serialized Supabase getSession. */
export async function getWorkspaceSession(
  options?: WorkspaceSessionOptions
): Promise<WorkspaceSessionResult> {
  if (!options?.bypassCache && cachedSession?.access_token) {
    return { session: cachedSession, error: null };
  }

  return runSerializedAuth(async () =>
    withLockRetry(async () => {
      const { data, error } = await supabase.auth.getSession();
      if (data.session) {
        cachedSession = data.session;
      } else if (options?.bypassCache) {
        cachedSession = null;
      }
      return { session: data.session ?? null, error };
    })
  );
}

/** Refresh tokens and update the centralized session cache. */
export async function refreshWorkspaceSession(): Promise<WorkspaceSessionResult> {
  return runSerializedAuth(async () =>
    withLockRetry(async () => {
      const { data, error } = await supabase.auth.refreshSession();
      cachedSession = data.session ?? null;
      return { session: data.session ?? null, error };
    })
  );
}

export async function getAccessToken(): Promise<string | null> {
  const { session } = await getWorkspaceSession();
  return session?.access_token ?? null;
}

export type WorkspaceUserValidation = {
  user: User | null;
  error: AuthError | null;
};

/**
 * Validates the JWT with Supabase Auth (server round-trip).
 * Required for remote session invalidation when the same account signs in elsewhere.
 */
export async function validateWorkspaceUser(): Promise<WorkspaceUserValidation> {
  return runSerializedAuth(async () =>
    withLockRetry(async () => {
      const { data, error } = await supabase.auth.getUser();
      return { user: data.user ?? null, error };
    })
  );
}

/** Bootstrap on cold start before AuthProvider has warmed the cache. */
export async function bootstrapWorkspaceSession(): Promise<WorkspaceSessionResult> {
  return runSerializedAuth(async () =>
    withLockRetry(async () => {
      const { data, error } = await supabase.auth.getSession();
      cachedSession = data.session ?? null;
      return { session: data.session ?? null, error };
    })
  );
}

/** Authenticated fetch: attaches Bearer token from centralized session. */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers);
  if (token && !headers.has('Authorization') && !headers.has('authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
