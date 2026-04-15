'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_THROTTLE_MS = 1000;
const STORAGE_KEY = 'workspace_idle_logout_sync_v1';

const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'scroll',
  'wheel',
  'touchstart',
] as const;

export type IdleLogoutState = {
  showWarning: boolean;
  secondsRemaining: number;
  staySignedIn: () => void;
};

type workspace_idle_logout_sync_state = {
  lastActivityAt: number;
  logoutAt: number;
};

export function useIdleLogout(
  enabled: boolean,
  idleMs: number,
  warningMs: number,
  onLogout: () => void | Promise<void>
): IdleLogoutState {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const idleMsRef = useRef(idleMs);
  const warningMsRef = useRef(warningMs);
  const onLogoutRef = useRef(onLogout);
  const enabledRef = useRef(enabled);

  idleMsRef.current = idleMs;
  warningMsRef.current = warningMs;
  onLogoutRef.current = onLogout;
  enabledRef.current = enabled;

  const tickerRef = useRef<number | null>(null);
  const lastThrottleRef = useRef(0);
  const logoutTriggeredRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    if (tickerRef.current !== null) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const readSyncState = useCallback((): workspace_idle_logout_sync_state | null => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<workspace_idle_logout_sync_state>;
      if (
        typeof parsed.lastActivityAt !== 'number' ||
        !Number.isFinite(parsed.lastActivityAt) ||
        typeof parsed.logoutAt !== 'number' ||
        !Number.isFinite(parsed.logoutAt)
      ) {
        return null;
      }
      return {
        lastActivityAt: parsed.lastActivityAt,
        logoutAt: parsed.logoutAt,
      };
    } catch {
      return null;
    }
  }, [clearAllTimers]);

  const writeActivityState = useCallback((): workspace_idle_logout_sync_state => {
    const now = Date.now();
    const next: workspace_idle_logout_sync_state = {
      lastActivityAt: now,
      logoutAt: now + idleMsRef.current,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }, []);

  const syncFromState = useCallback(
    (state: workspace_idle_logout_sync_state | null) => {
      if (!enabledRef.current) {
        setShowWarning(false);
        setSecondsRemaining(0);
        return;
      }

      if (!state) {
        setShowWarning(false);
        setSecondsRemaining(0);
        return;
      }

      const remainingMs = state.logoutAt - Date.now();
      if (remainingMs <= 0) {
        setShowWarning(false);
        setSecondsRemaining(0);
        if (!logoutTriggeredRef.current) {
          logoutTriggeredRef.current = true;
          void Promise.resolve(onLogoutRef.current());
        }
        return;
      }

      logoutTriggeredRef.current = false;
      const secs = Math.ceil(remainingMs / 1000);
      const warningMsLocal = warningMsRef.current;
      setShowWarning(remainingMs <= warningMsLocal);
      setSecondsRemaining(secs);
    },
    []
  );

  const resetIdleDeadline = useCallback(() => {
    if (!enabledRef.current) return;
    const next = writeActivityState();
    syncFromState(next);
  }, [syncFromState, writeActivityState]);

  const staySignedIn = useCallback(() => {
    resetIdleDeadline();
  }, [resetIdleDeadline]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastThrottleRef.current < ACTIVITY_THROTTLE_MS) return;
    lastThrottleRef.current = now;
    resetIdleDeadline();
  }, [resetIdleDeadline]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!enabled) {
      clearAllTimers();
      setShowWarning(false);
      setSecondsRemaining(0);
      logoutTriggeredRef.current = false;
      return;
    }

    const existing = readSyncState();
    if (!existing || existing.logoutAt <= Date.now()) {
      const next = writeActivityState();
      syncFromState(next);
    } else {
      syncFromState(existing);
    }

    tickerRef.current = window.setInterval(() => {
      syncFromState(readSyncState());
    }, 1000);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      syncFromState(readSyncState());
    };

    const handleVisibilityOrFocus = () => {
      syncFromState(readSyncState());
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearAllTimers();
    };
  }, [enabled, idleMs, warningMs, clearAllTimers, readSyncState, syncFromState, writeActivityState]);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    const opts: AddEventListenerOptions = { passive: true, capture: true };
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, handleActivity, opts);
    }
    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, handleActivity, opts);
      }
    };
  }, [enabled, handleActivity]);

  return { showWarning, secondsRemaining, staySignedIn };
}
