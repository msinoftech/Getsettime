'use client';

import { useCallback, useEffect, useState } from 'react';
import { saveCountry } from './country-storage';
import { getCachedManualTimezone, saveManualTimezone } from './timezone-storage';
import {
  resolveLocationContextWithGeo,
  type location_context,
} from './location-context';

export type use_location_context_options = {
  hostTimezone?: string | null;
  profileCountry?: string | null;
};

export function useLocationContext(options?: use_location_context_options) {
  const [context, setContext] = useState<location_context | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualTimezone, setManualTimezone] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : getCachedManualTimezone()
  );
  const [manualCountry, setManualCountry] = useState<string | null>(null);

  const hostTimezone = options?.hostTimezone;
  const profileCountry = options?.profileCountry;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const ctx = await resolveLocationContextWithGeo({
        hostTimezone,
        profileCountry,
        manualTimezone,
        manualCountry,
      });
      setContext(ctx);
    } finally {
      setLoading(false);
    }
  }, [hostTimezone, profileCountry, manualTimezone, manualCountry]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setCustomerTimezone = useCallback((tz: string) => {
    const trimmed = tz.trim();
    if (!trimmed) return;
    saveManualTimezone(trimmed);
    setManualTimezone(trimmed);
  }, []);

  const setCustomerCountry = useCallback((code: string) => {
    const upper = code.toUpperCase();
    if (upper.length !== 2) return;
    saveCountry(upper);
    setManualCountry(upper);
  }, []);

  return {
    context,
    loading,
    customerTimezone: manualTimezone ?? context?.timezone ?? null,
    customerCountry: manualCountry ?? context?.country ?? null,
    hasManualTimezone: Boolean(manualTimezone),
    setCustomerTimezone,
    setCustomerCountry,
    refresh,
  };
}
