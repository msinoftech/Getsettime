'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthProvider';
import {
  fetchSubscriptionApi,
  type SubscriptionApiResponse,
} from '@/src/lib/subscription_api';

export type SubscriptionHook = {
  data: SubscriptionApiResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionHook | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuth();
  const userId = user?.id ?? null;
  const workspaceIdRaw = user?.user_metadata?.workspace_id;
  const workspaceId =
    typeof workspaceIdRaw === 'number'
      ? workspaceIdRaw
      : parseInt(String(workspaceIdRaw ?? ''), 10);
  const cacheKey =
    userId && Number.isFinite(workspaceId) && workspaceId > 0
      ? `${userId}:${workspaceId}`
      : userId;

  const [data, setData] = useState<SubscriptionApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchGenerationRef = useRef(0);

  const clearState = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  const loadFromNetwork = useCallback(
    async (options?: { showLoading?: boolean; force?: boolean }) => {
      if (!userId || !cacheKey || !accessToken) {
        clearState();
        return;
      }

      const generation = ++fetchGenerationRef.current;
      if (options?.showLoading !== false) {
        setLoading(true);
      }
      setError(null);

      try {
        const json = await fetchSubscriptionApi(accessToken, cacheKey, {
          force: options?.force,
        });

        if (generation === fetchGenerationRef.current) {
          setData(json);
        }
      } catch (e) {
        if (generation === fetchGenerationRef.current) {
          setError(e instanceof Error ? e.message : 'Failed to load subscription');
          setData(null);
        }
      } finally {
        if (generation === fetchGenerationRef.current) {
          setLoading(false);
        }
      }
    },
    [userId, cacheKey, accessToken, clearState]
  );

  const refresh = useCallback(async () => {
    await loadFromNetwork({ showLoading: true, force: true });
  }, [loadFromNetwork]);

  useEffect(() => {
    if (!userId || !cacheKey || !accessToken) {
      fetchGenerationRef.current += 1;
      clearState();
      return;
    }

    // Defer until after login/dashboard burst (bookings, settings, etc.) to reduce dev-server contention.
    let cancelled = false;
    const run = () => {
      if (!cancelled) void loadFromNetwork({ showLoading: true });
    };

    if (typeof window === 'undefined') {
      run();
      return;
    }

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(run, { timeout: 1200 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = setTimeout(run, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [userId, cacheKey, accessToken, loadFromNetwork, clearState]);

  const value: SubscriptionHook = {
    data,
    loading,
    error,
    refresh,
  };

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext(): SubscriptionHook {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}
