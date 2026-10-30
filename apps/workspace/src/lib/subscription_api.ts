import type { plans, workspace_subscriptions, workspace_usage } from '@app/db/subscription';

export type SubscriptionApiResponse = {
  plan: plans;
  subscription?: workspace_subscriptions;
  usage: workspace_usage;
  thresholds: {
    booking_warning_percent: number;
    booking_warning: boolean;
    booking_limit_reached: boolean;
  };
};

const inflightByKey = new Map<string, Promise<SubscriptionApiResponse>>();

/** Deduped fetch for /api/subscription (collapses parallel mounts / Strict Mode). */
export async function fetchSubscriptionApi(
  accessToken: string,
  cacheKey: string,
  options?: { force?: boolean }
): Promise<SubscriptionApiResponse> {
  if (!options?.force) {
    const existing = inflightByKey.get(cacheKey);
    if (existing) return existing;
  }

  const promise = (async () => {
    const res = await fetch('/api/subscription', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Failed to load subscription');
    }
    return (await res.json()) as SubscriptionApiResponse;
  })();

  inflightByKey.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    if (inflightByKey.get(cacheKey) === promise) {
      inflightByKey.delete(cacheKey);
    }
  }
}
