export type booking_step_nav_context = {
  step: number;
  totalSteps: number;
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
  /** True on post-submit success screens where step navigation should be disabled. */
  isSuccessScreen?: boolean;
};

function is_continue_enabled(ctx: booking_step_nav_context): boolean {
  switch (ctx.step) {
    case 1:
      return (
        ctx.hasSelectedDepartment &&
        (!ctx.showProviderPicker || ctx.hasSelectedProvider)
      );
    case 2:
      return ctx.hasSelectedType && !ctx.loadingEventTypes;
    case 3:
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
  target: number
): boolean {
  if (target >= ctx.step) return false;

  if (ctx.departmentsCount === 0 && target === 1) return false;

  if (ctx.isRescheduleMode) {
    if (ctx.step === 3 && target < 3) return false;
    if (ctx.step === 2 && target === 1) return false;
  }

  return true;
}

export function can_navigate_to_booking_step(
  ctx: booking_step_nav_context,
  target: number
): boolean {
  if (target === ctx.step) return false;
  if (target < 1 || target > ctx.totalSteps) return false;
  if (ctx.isSuccessScreen) return false;

  if (target === ctx.step + 1) {
    if (ctx.isRescheduleMode && ctx.step === 3) return false;
    return is_continue_enabled(ctx);
  }

  if (target < ctx.step) {
    return can_navigate_back_to(ctx, target);
  }

  return false;
}
