'use client';

import React, {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ToastViewport } from './ToastViewport';
import {
  DEFAULT_TOAST_DURATION,
  MAX_TOAST_STACK,
  TOAST_DEDUPE_MS,
  TOAST_EXIT_ANIMATION_MS,
  type ToastItem,
  type ToastOptions,
  type ToastPosition,
  type ToastVariant,
} from './toast.types';

export type ToastContextValue = {
  show: (options: ToastOptions) => string;
  success: (message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  error: (message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  warning: (message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  info: (message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

type ToastProviderProps = {
  children: React.ReactNode;
  defaultPosition?: ToastPosition;
};

function createToastId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ToastProvider({
  children,
  defaultPosition = 'top-right',
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const exitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const recentRef = useRef<Map<string, number>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const clearExitTimer = useCallback((id: string) => {
    const timer = exitTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      exitTimersRef.current.delete(id);
    }
  }, []);

  const removeToast = useCallback(
    (id: string) => {
      clearExitTimer(id);
      setExitingIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearExitTimer]
  );

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setExitingIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      clearExitTimer(id);
      const timer = setTimeout(() => removeToast(id), TOAST_EXIT_ANIMATION_MS);
      exitTimersRef.current.set(id, timer);
    },
    [clearExitTimer, clearTimer, removeToast]
  );

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    exitTimersRef.current.forEach((timer) => clearTimeout(timer));
    exitTimersRef.current.clear();
    setExitingIds(new Set());
    setToasts([]);
  }, []);

  const scheduleDismiss = useCallback(
    (id: string, duration: number) => {
      if (duration <= 0) return;
      clearTimer(id);
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    },
    [clearTimer, dismiss]
  );

  const show = useCallback(
    (options: ToastOptions): string => {
      const variant: ToastVariant = options.variant ?? 'info';
      const message = options.message.trim();
      if (!message) return '';

      const dedupeKey = `${variant}:${message}`;
      const now = Date.now();
      const lastShown = recentRef.current.get(dedupeKey);
      if (lastShown != null && now - lastShown < TOAST_DEDUPE_MS) {
        let existingId = '';
        setToasts((prev) => {
          const existing = prev.find(
            (t) => t.variant === variant && t.message === message
          );
          if (existing) existingId = existing.id;
          return prev;
        });
        if (existingId) return existingId;
      }
      recentRef.current.set(dedupeKey, now);

      const id = createToastId();
      const duration =
        options.duration ?? DEFAULT_TOAST_DURATION[variant];
      const item: ToastItem = {
        id,
        message,
        variant,
        title: options.title,
        position: options.position ?? defaultPosition,
        duration,
        dismissible: options.dismissible ?? true,
        action: options.action,
      };

      setToasts((prev) => {
        const next = [...prev, item];
        if (next.length > MAX_TOAST_STACK) {
          const removed = next.slice(0, next.length - MAX_TOAST_STACK);
          removed.forEach((t) => {
            clearTimer(t.id);
            clearExitTimer(t.id);
          });
          return next.slice(-MAX_TOAST_STACK);
        }
        return next;
      });

      scheduleDismiss(id, duration);
      return id;
    },
    [clearExitTimer, clearTimer, defaultPosition, scheduleDismiss]
  );

  const showVariant = useCallback(
    (
      variant: ToastVariant,
      message: string,
      options?: Omit<ToastOptions, 'message' | 'variant'>
    ) => show({ ...options, message, variant }),
    [show]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message, options) => showVariant('success', message, options),
      error: (message, options) => showVariant('error', message, options),
      warning: (message, options) => showVariant('warning', message, options),
      info: (message, options) => showVariant('info', message, options),
      dismiss,
      dismissAll,
    }),
    [dismiss, dismissAll, show, showVariant]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport
        toasts={toasts}
        exitingIds={exitingIds}
        onDismiss={dismiss}
      />
    </ToastContext.Provider>
  );
}
