'use client';

import { useEffect, useState } from 'react';

let load_promise: Promise<void> | null = null;

function load_google_maps_script(api_key: string): Promise<void> {
  if (typeof window !== 'undefined' && window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (load_promise) return load_promise;

  load_promise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps="true"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Google Maps'))
      );
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(api_key)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });

  return load_promise;
}

export function useGoogleMapsScript() {
  const api_key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';
  const [ready, set_ready] = useState(
    typeof window !== 'undefined' && Boolean(window.google?.maps?.places)
  );
  const [error, set_error] = useState<string | null>(null);

  useEffect(() => {
    if (!api_key) {
      set_error('Google Maps API key is not configured.');
      return;
    }

    let cancelled = false;

    void load_google_maps_script(api_key)
      .then(() => {
        if (!cancelled) {
          set_ready(true);
          set_error(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          set_error(
            err instanceof Error ? err.message : 'Failed to load Google Maps'
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api_key]);

  return { ready, error, api_key };
}
