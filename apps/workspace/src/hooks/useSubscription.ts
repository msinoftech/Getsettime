'use client';

import { useSubscriptionContext } from '@/src/providers/SubscriptionProvider';

export type { SubscriptionApiResponse } from '@/src/lib/subscription_api';

/**
 * Shared workspace subscription (single fetch via SubscriptionProvider).
 * Pass enabled=false to skip exposing data without triggering extra work.
 */
export function useSubscription(enabled = true) {
  const ctx = useSubscriptionContext();

  if (!enabled) {
    return {
      data: null,
      loading: false,
      error: null,
      refresh: ctx.refresh,
    };
  }

  return ctx;
}
