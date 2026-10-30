'use client';

import { useEffect, useState } from 'react';
import { LuX } from 'react-icons/lu';
import {
  getToastInitialClass,
  getToastMotionClass,
  getToastOriginClass,
} from './toast.motion';
import type { ToastItem, ToastVariant } from './toast.types';

const VARIANT_STYLES: Record<
  ToastVariant,
  { container: string; icon: string; iconPath: string }
> = {
  success: {
    container: 'bg-green-50 border-green-200 text-green-700',
    icon: 'text-green-600',
    iconPath:
      'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z',
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-700',
    icon: 'text-red-600',
    iconPath:
      'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: 'text-amber-600',
    iconPath:
      'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z',
  },
  info: {
    container: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    icon: 'text-indigo-600',
    iconPath:
      'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z',
  },
};

type ToastProps = {
  item: ToastItem;
  exiting?: boolean;
  onDismiss: (id: string) => void;
};

export function Toast({ item, exiting = false, onDismiss }: ToastProps) {
  const style = VARIANT_STYLES[item.variant];
  const originClass = getToastOriginClass(item.position);
  const [enterActive, setEnterActive] = useState(false);

  useEffect(() => {
    if (exiting) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEnterActive(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [exiting, item.id]);

  const motionClass = exiting
    ? getToastMotionClass(item.position, true)
    : enterActive
      ? getToastMotionClass(item.position, false)
      : getToastInitialClass(item.position);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-xl ring-1 ring-black/5 transition-[transform,opacity,box-shadow] duration-300 ease-out will-change-transform ${originClass} ${motionClass} ${style.container}`}
    >
      <svg
        className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`}
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden
      >
        <path fillRule="evenodd" d={style.iconPath} clipRule="evenodd" />
      </svg>
      <div className="min-w-0 flex-1">
        {item.title ? (
          <p className="text-sm font-semibold">{item.title}</p>
        ) : null}
        <p className={`text-sm ${item.title ? 'mt-0.5' : ''}`}>{item.message}</p>
        {item.action ? (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              onDismiss(item.id);
            }}
            className="mt-2 text-sm font-medium underline underline-offset-2 hover:opacity-80"
          >
            {item.action.label}
          </button>
        ) : null}
      </div>
      {item.dismissible ? (
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          className="shrink-0 rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
          aria-label="Dismiss"
        >
          <LuX className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
