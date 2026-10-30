import type { ToastContextValue } from './ToastProvider';
import type { ToastOptions } from './toast.types';

let toastRef: ToastContextValue | null = null;

export function registerToastApi(api: ToastContextValue): void {
  toastRef = api;
}

export function unregisterToastApi(): void {
  toastRef = null;
}

function getApi(): ToastContextValue {
  if (!toastRef) {
    throw new Error(
      'toast() called before ToastProvider mounted. Use useToast() inside React, or ensure ToastProvider wraps the app.'
    );
  }
  return toastRef;
}

/** Imperative toast API — usable outside React components when ToastProvider is mounted. */
export const toast = {
  show(options: ToastOptions) {
    return getApi().show(options);
  },
  success(
    message: string,
    options?: Omit<ToastOptions, 'message' | 'variant'>
  ) {
    return getApi().success(message, options);
  },
  error(message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) {
    return getApi().error(message, options);
  },
  warning(
    message: string,
    options?: Omit<ToastOptions, 'message' | 'variant'>
  ) {
    return getApi().warning(message, options);
  },
  info(message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) {
    return getApi().info(message, options);
  },
  dismiss(id: string) {
    getApi().dismiss(id);
  },
  dismissAll() {
    getApi().dismissAll();
  },
};
