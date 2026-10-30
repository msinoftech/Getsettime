import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_BOOKING_STEP_ORDER,
  progress_booking_step_ids,
  type booking_step_id,
} from '@/src/features/booking-flow';

type UseBookingStepFlowOptions = {
  step_order?: readonly booking_step_id[] | null;
  initial_step_id?: booking_step_id;
  hide_success_in_progress?: boolean;
};

export function useBookingStepFlow({
  step_order,
  initial_step_id,
  hide_success_in_progress = false,
}: UseBookingStepFlowOptions = {}) {
  const resolved_order = useMemo(
    () =>
      step_order && step_order.length > 0
        ? [...step_order]
        : [...DEFAULT_BOOKING_STEP_ORDER],
    [step_order]
  );

  const [current_step_id, set_current_step_id] = useState<booking_step_id>(
    initial_step_id ?? resolved_order[0] ?? 'department_provider'
  );

  const progress_ids = useMemo(
    () =>
      hide_success_in_progress
        ? progress_booking_step_ids(resolved_order)
        : resolved_order,
    [hide_success_in_progress, resolved_order]
  );

  const is_step = useCallback(
    (id: booking_step_id) => current_step_id === id,
    [current_step_id]
  );

  const go_to_step = useCallback((id: booking_step_id) => {
    set_current_step_id(id);
  }, []);

  return {
    current_step_id,
    step_order: resolved_order,
    progress_ids,
    is_step,
    go_to_step,
    set_current_step_id,
    is_success: current_step_id === 'success',
  };
}
