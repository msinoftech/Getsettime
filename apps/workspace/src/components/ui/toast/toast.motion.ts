import type { ToastPosition } from './toast.types';

type ToastMotionClasses = {
  enter: string;
  exit: string;
};

const MOTION_BY_POSITION: Record<ToastPosition, ToastMotionClasses> = {
  'top-right': { enter: 'toast-enter-top-right', exit: 'toast-exit-top-right' },
  'bottom-right': { enter: 'toast-enter-right', exit: 'toast-exit-right' },
  'top-left': { enter: 'toast-enter-left', exit: 'toast-exit-left' },
  'bottom-left': { enter: 'toast-enter-left', exit: 'toast-exit-left' },
  'top-center': { enter: 'toast-enter-down', exit: 'toast-exit-up' },
  'bottom-center': { enter: 'toast-enter-up', exit: 'toast-exit-down' },
};

export function getToastMotionClass(
  position: ToastPosition,
  exiting: boolean
): string {
  const motion = MOTION_BY_POSITION[position];
  return exiting ? motion.exit : motion.enter;
}

export function getToastOriginClass(position: ToastPosition): string {
  if (position === 'top-right') return 'origin-top-right';
  if (position.endsWith('-left')) return 'origin-left';
  if (position.endsWith('-center')) {
    return position.startsWith('bottom') ? 'origin-bottom' : 'origin-top';
  }
  return 'origin-right';
}

/** Pre-enter frame so top-right motion starts off-screen before animation class applies. */
export function getToastInitialClass(position: ToastPosition): string {
  if (position === 'top-right') {
    return 'opacity-0 translate-x-8 -translate-y-2 scale-[0.97]';
  }
  return 'opacity-0';
}
