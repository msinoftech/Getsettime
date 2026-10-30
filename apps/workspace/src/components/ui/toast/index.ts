/**
 * Global toast notifications for the workspace app.
 *
 * @example
 * import { toast } from '@/src/components/ui/toast';
 * toast.success('Saved');
 * toast.error('Something went wrong');
 *
 * @example
 * const { toast } = useToast();
 * toast.show({ variant: 'info', title: 'Updated', message: 'Changes applied.' });
 */
export { ToastProvider } from './ToastProvider';
export { ToastRegistrar } from './ToastRegistrar';
export { useToast } from './useToast';
export { toast } from './toast-api';
export type {
  ToastAction,
  ToastItem,
  ToastOptions,
  ToastPosition,
  ToastVariant,
} from './toast.types';
