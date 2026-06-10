'use client';

import { useEffect, useState } from 'react';
import {
  detectCountry,
  DEFAULT_COUNTRY,
  getCachedCountry,
} from '@app/location';

function isProfileCountryIso2(profileCountry?: string | null): boolean {
  const p = profileCountry?.trim().toUpperCase();
  return Boolean(p && p.length === 2);
}

export function useDefaultPhoneCountry(profileCountry?: string | null) {
  const profileIso2 = isProfileCountryIso2(profileCountry)
    ? profileCountry!.trim().toUpperCase()
    : null;
  const cachedOnMount = typeof window !== 'undefined' ? getCachedCountry() : null;

  const [country, setCountry] = useState(profileIso2 ?? cachedOnMount ?? DEFAULT_COUNTRY);
  const [loadingCountry, setLoadingCountry] = useState(
    !profileIso2 && !cachedOnMount
  );

  useEffect(() => {
    let cancelled = false;
    if (!profileIso2) setLoadingCountry(true);

    void detectCountry({ profileCountry: profileIso2 ?? profileCountry }).then((result) => {
      if (!cancelled) {
        setCountry(result.country);
        setLoadingCountry(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profileCountry, profileIso2]);

  return { country, loadingCountry, setCountry };
}
