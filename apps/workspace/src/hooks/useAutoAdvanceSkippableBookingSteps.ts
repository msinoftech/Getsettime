import { useLayoutEffect } from 'react';
import {
  resolve_effective_booking_step_id,
  type booking_step_id,
  type booking_step_states,
} from '@/src/features/booking-flow';

type UseAutoAdvanceSkippableBookingStepsParams = {
  enabled: boolean;
  current_step_id: booking_step_id;
  step_order: readonly booking_step_id[];
  step_states: booking_step_states;
  go_to_step: (id: booking_step_id) => void;
};

/** Skip past settled single-option steps before the browser paints. */
export function useAutoAdvanceSkippableBookingSteps({
  enabled,
  current_step_id,
  step_order,
  step_states,
  go_to_step,
}: UseAutoAdvanceSkippableBookingStepsParams) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const effective_step_id = resolve_effective_booking_step_id(
      step_order,
      current_step_id,
      step_states
    );
    if (effective_step_id !== current_step_id) {
      go_to_step(effective_step_id);
    }
  }, [enabled, current_step_id, step_order, step_states, go_to_step]);
}
