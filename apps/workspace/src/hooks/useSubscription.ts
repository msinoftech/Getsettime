"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { plans, workspace_usage } from "@app/db/subscription";

export type SubscriptionApiResponse = {
  plan: plans;
  usage: workspace_usage;
  thresholds: {
    booking_warning_percent: number;
    booking_warning: boolean;
    booking_limit_reached: boolean;
  };
};

export function useSubscription(enabled = true) {
  const [data, setData] = useState<SubscriptionApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setData(null);
        return;
      }
      const res = await fetch("/api/subscription", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to load subscription");
      }
      const json = (await res.json()) as SubscriptionApiResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load subscription");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
