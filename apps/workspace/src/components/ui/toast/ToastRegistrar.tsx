'use client';

import { useEffect } from 'react';
import { registerToastApi, unregisterToastApi } from './toast-api';
import { useToast } from './useToast';

/** Registers the imperative `toast` module API when mounted inside ToastProvider. */
export function ToastRegistrar() {
  const api = useToast();

  useEffect(() => {
    registerToastApi(api);
    return () => unregisterToastApi();
  }, [api]);

  return null;
}
