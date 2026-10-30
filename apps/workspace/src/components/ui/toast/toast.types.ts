export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export type ToastPosition =
  | 'top-right'
  | 'top-center'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left';

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastOptions = {
  variant?: ToastVariant;
  title?: string;
  message: string;
  position?: ToastPosition;
  duration?: number;
  dismissible?: boolean;
  action?: ToastAction;
};

export type ToastItem = Required<Pick<ToastOptions, 'message'>> & {
  id: string;
  variant: ToastVariant;
  title?: string;
  position: ToastPosition;
  duration: number;
  dismissible: boolean;
  action?: ToastAction;
};

export const MAX_TOAST_STACK = 5;

export const DEFAULT_TOAST_DURATION: Record<ToastVariant, number> = {
  success: 5000,
  error: 8000,
  warning: 6000,
  info: 5000,
};

export const TOAST_DEDUPE_MS = 2000;

import { Z_TOAST } from '@/src/constants/z-index';

/** Re-export for toast viewport stacking. See `src/constants/z-index.ts`. */
export const TOAST_VIEWPORT_Z_INDEX = Z_TOAST;

/** Must match longest exit animation duration in globals.css */
export const TOAST_EXIT_ANIMATION_MS = 300;
