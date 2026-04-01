'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_THROTTLE_MS = 1000;

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

  const phase1Ref = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const remainingRef = useRef(0);
  const lastThrottleRef = useRef(0);

  const clearAllTimers = useCallback(() => {
    if (phase1Ref.current !== null) {
      clearTimeout(phase1Ref.current);
      phase1Ref.current = null;
    }
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const openWarningPhase = useCallback(() => {
    clearAllTimers();
    const warningMsLocal = warningMsRef.current;
    const secs = Math.max(1, Math.ceil(warningMsLocal / 1000));
    remainingRef.current = secs;
    setShowWarning(true);
    setSecondsRemaining(secs);
    countdownRef.current = window.setInterval(() => {
      remainingRef.current -= 1;
      setSecondsRemaining(remainingRef.current);
      if (remainingRef.current <= 0) {
        if (countdownRef.current !== null) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        setShowWarning(false);
        void Promise.resolve(onLogoutRef.current());
      }
    }, 1000);
  }, [clearAllTimers]);

  const startPhase1 = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    setSecondsRemaining(0);
    if (!enabledRef.current) return;

    const idle = idleMsRef.current;
    const warning = warningMsRef.current;
    const phase1Ms = Math.max(0, idle - warning);

    if (phase1Ms <= 0) {
      openWarningPhase();
      return;
    }

    phase1Ref.current = window.setTimeout(() => {
      phase1Ref.current = null;
      openWarningPhase();
    }, phase1Ms);
  }, [clearAllTimers, openWarningPhase]);

  const staySignedIn = useCallback(() => {
    startPhase1();
  }, [startPhase1]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastThrottleRef.current < ACTIVITY_THROTTLE_MS) return;
    lastThrottleRef.current = now;
    startPhase1();
  }, [startPhase1]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!enabled) {
      clearAllTimers();
      setShowWarning(false);
      setSecondsRemaining(0);
      return;
    }

    startPhase1();

    return () => {
      clearAllTimers();
    };
  }, [enabled, idleMs, warningMs, clearAllTimers, startPhase1]);

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
