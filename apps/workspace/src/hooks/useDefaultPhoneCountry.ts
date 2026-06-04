'use client';

import { useEffect, useState } from 'react';
import { detectCountry, DEFAULT_COUNTRY } from '@/src/services/countryDetection';

export function useDefaultPhoneCountry(profileCountry?: string | null) {
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [loadingCountry, setLoadingCountry] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingCountry(true);
    void detectCountry({ profileCountry }).then((code) => {
      if (!cancelled) {
        setCountry(code);
        setLoadingCountry(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profileCountry]);

  return { country, loadingCountry, setCountry };
}
