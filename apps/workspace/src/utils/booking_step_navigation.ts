import type { booking_step_id } from '@/src/features/booking-flow';

export type booking_step_nav_context = {
  current_step_id: booking_step_id;
  step_order: readonly booking_step_id[];
  departmentsCount: number;
  showProviderPicker: boolean;
  hasSelectedDepartment: boolean;
  hasSelectedProvider: boolean;
  hasSelectedType: boolean;
  loadingEventTypes: boolean;
  hasSelectedDate: boolean;
  hasSelectedTime: boolean;
  isRescheduleMode?: boolean;
  rescheduleContinueDisabled?: boolean;
  isSuccessScreen?: boolean;
};

function is_continue_enabled(ctx: booking_step_nav_context): boolean {
  switch (ctx.current_step_id) {
    case 'department_provider':
      return (
        ctx.hasSelectedDepartment &&
        (!ctx.showProviderPicker || ctx.hasSelectedProvider)
      );
    case 'event_type':
      return ctx.hasSelectedType && !ctx.loadingEventTypes;
    case 'date_time':
      if (ctx.isRescheduleMode) {
        return (
          ctx.hasSelectedDate &&
          ctx.hasSelectedTime &&
          !ctx.rescheduleContinueDisabled
        );
      }
      return ctx.hasSelectedDate && ctx.hasSelectedTime;
    default:
      return false;
  }
}

function can_navigate_back_to(
  ctx: booking_step_nav_context,
  target: booking_step_id
): boolean {
  const current_index = ctx.step_order.indexOf(ctx.current_step_id);
  const target_index = ctx.step_order.indexOf(target);
  if (target_index < 0 || target_index >= current_index) return false;

  if (ctx.departmentsCount === 0 && target === 'department_provider') return false;

  if (ctx.isRescheduleMode) {
    if (ctx.current_step_id === 'date_time' && target !== 'date_time') return false;
    if (ctx.current_step_id === 'event_type' && target === 'department_provider') {
      return false;
    }
  }

  return true;
}

export function can_navigate_to_booking_step(
  ctx: booking_step_nav_context,
  target: booking_step_id
): boolean {
  if (target === ctx.current_step_id) return false;
  if (ctx.isSuccessScreen) return false;
  if (!ctx.step_order.includes(target)) return false;

  const current_index = ctx.step_order.indexOf(ctx.current_step_id);
  const target_index = ctx.step_order.indexOf(target);

  if (target_index === current_index + 1) {
    if (ctx.isRescheduleMode && ctx.current_step_id === 'date_time') return false;
    return is_continue_enabled(ctx);
  }

  if (target_index < current_index) {
    return can_navigate_back_to(ctx, target);
  }

  return false;
}
