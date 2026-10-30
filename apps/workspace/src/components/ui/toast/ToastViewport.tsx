'use client';

import { createPortal } from 'react-dom';
import { Toast } from './Toast';
import {
  TOAST_VIEWPORT_Z_INDEX,
  type ToastItem,
  type ToastPosition,
} from './toast.types';

const POSITION_CLASSES: Record<ToastPosition, string> = {
  // top-20 clears the sticky Topbar (h-16) with a small gap
  'top-right': 'top-20 right-4 items-end overflow-visible',
  'top-center': 'top-20 left-1/2 -translate-x-1/2 items-center',
  'top-left': 'top-20 left-4 items-start',
  'bottom-right': 'bottom-4 right-4 items-end',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-left': 'bottom-4 left-4 items-start',
};

type ToastViewportProps = {
  toasts: ToastItem[];
  exitingIds: ReadonlySet<string>;
  onDismiss: (id: string) => void;
};

export function ToastViewport({
  toasts,
  exitingIds,
  onDismiss,
}: ToastViewportProps) {
  if (typeof document === 'undefined' || toasts.length === 0) return null;

  const byPosition = toasts.reduce<Record<ToastPosition, ToastItem[]>>(
    (acc, toast) => {
      const list = acc[toast.position] ?? [];
      list.push(toast);
      acc[toast.position] = list;
      return acc;
    },
    {} as Record<ToastPosition, ToastItem[]>
  );

  return createPortal(
    <>
      {(Object.entries(byPosition) as [ToastPosition, ToastItem[]][]).map(
        ([position, items]) => (
          <div
            key={position}
            className={`pointer-events-none fixed flex flex-col gap-2 ${POSITION_CLASSES[position]}`}
            style={{ zIndex: TOAST_VIEWPORT_Z_INDEX }}
          >
            {items.map((item) => (
              <Toast
                key={item.id}
                item={item}
                exiting={exitingIds.has(item.id)}
                onDismiss={onDismiss}
              />
            ))}
          </div>
        )
      )}
    </>,
    document.body
  );
}
