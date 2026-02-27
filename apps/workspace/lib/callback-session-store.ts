/**
 * Short-lived in-memory store for Supabase session handoff from signup to /auth/callback.
 * Tokens are never put in the URL; a one-time id is stored in a cookie instead.
 */

const store = new Map<
  string,
  { access_token: string; refresh_token: string }
>();

const MAX_AGE_MS = 60 * 1000; // 1 minute
const timestamps = new Map<string, number>();

export function setCallbackSession(
  id: string,
  session: { access_token: string; refresh_token: string }
): void {
  store.set(id, session);
  timestamps.set(id, Date.now());
}

export function takeCallbackSession(
  id: string
): { access_token: string; refresh_token: string } | null {
  // Optional: evict expired entries
  const ts = timestamps.get(id);
  if (ts != null && Date.now() - ts > MAX_AGE_MS) {
    store.delete(id);
    timestamps.delete(id);
    return null;
  }
  const s = store.get(id);
  if (s) {
    store.delete(id);
    timestamps.delete(id);
    return s;
  }
  return null;
}
