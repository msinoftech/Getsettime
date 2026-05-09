'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { logAuthActivityFromSession } from '@/src/lib/auth_activity_log_client';

/** How often to ask Supabase Auth if this JWT is still valid (detect login elsewhere / revoked refresh). */
const POLL_INTERVAL_MS = 20_000;
const FOCUS_THROTTLE_MS = 6_000;
/** Require two failed validation cycles in a row before signing out (reduces false positives on flaky networks). */
const CONSECUTIVE_FAILURES_BEFORE_SIGNOUT = 2;

/**
 * When another client signs in with the same account, Supabase often invalidates older refresh tokens.
 * This session then fails getUser() on the next check — we sign out this browser without waiting for an API 401.
 */
export function useRemoteSessionInvalidation(enabled: boolean, pathname: string) {
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (pathnameRef.current === '/auth/callback') return;

    let stopped = false;
    let lastFocusCheck = 0;
    let consecutiveFailures = 0;

    const redirectSessionEnded = () => {
      const path = pathnameRef.current + window.location.search;
      const next = encodeURIComponent(path);
      window.location.assign(`/login?reason=session_ended&next=${next}`);
    };

    const validate = async () => {
      if (stopped) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        consecutiveFailures = 0;
        return;
      }

      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (stopped) return;
        const { error } = await supabase.auth.getUser();
        if (!error) {
          consecutiveFailures = 0;
          return;
        }
        lastError = error;
        await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
      }
      if (stopped) return;

      consecutiveFailures += 1;
      if (consecutiveFailures < CONSECUTIVE_FAILURES_BEFORE_SIGNOUT) {
        console.warn(
          '[useRemoteSessionInvalidation] getUser failed after retries; waiting for another failed cycle before sign-out',
          lastError
        );
        return;
      }

      console.warn('[useRemoteSessionInvalidation] getUser failed repeatedly; signing out', lastError);

      try {
        await logAuthActivityFromSession('logout', { reason: 'remote_invalidation' });
      } catch {
        /* ignore */
      }
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        /* ignore */
      }
      redirectSessionEnded();
    };

    const intervalId = window.setInterval(() => {
      void validate();
    }, POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void validate();
    };

    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocusCheck < FOCUS_THROTTLE_MS) return;
      lastFocusCheck = now;
      void validate();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, pathname]);
}
