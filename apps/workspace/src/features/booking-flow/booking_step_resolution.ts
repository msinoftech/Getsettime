import { booking_step_index, type booking_step_id } from './booking_step';

export type booking_step_state = {
  /** More than one option exists, so the user has a real choice to make. */
  requires_user_input: boolean;
  /** Options are still loading or the sole option is still being applied. */
  is_resolving: boolean;
};

export type booking_step_states = Partial<
  Record<booking_step_id, booking_step_state>
>;

/** Steps that always need the user, however few options they offer. */
const ALWAYS_INTERACTIVE_STEP_IDS: readonly booking_step_id[] = [
  'date_time',
  'intake',
  'success',
];

const INTERACTIVE_STEP_STATE: booking_step_state = {
  requires_user_input: true,
  is_resolving: false,
};

export function booking_step_state_of(
  states: booking_step_states,
  step_id: booking_step_id
): booking_step_state {
  if (ALWAYS_INTERACTIVE_STEP_IDS.includes(step_id)) {
    return INTERACTIVE_STEP_STATE;
  }
  return states[step_id] ?? INTERACTIVE_STEP_STATE;
}

/** A step is skipped only once its sole option is settled and applied. */
export function is_booking_step_skippable(
  states: booking_step_states,
  step_id: booking_step_id
): boolean {
  const state = booking_step_state_of(states, step_id);
  return !state.requires_user_input && !state.is_resolving;
}

/** True while a step with no choice to offer is still settling its sole option. */
export function is_booking_step_resolving(
  states: booking_step_states,
  step_id: booking_step_id
): boolean {
  const state = booking_step_state_of(states, step_id);
  return state.is_resolving && !state.requires_user_input;
}

/** Next step in the configured order that the user must see. */
export function resolve_next_booking_step_id(
  order: readonly booking_step_id[],
  from: booking_step_id,
  states: booking_step_states
): booking_step_id | null {
  const index = booking_step_index(order, from);
  if (index < 0) return null;
  for (let i = index + 1; i < order.length; i += 1) {
    if (!is_booking_step_skippable(states, order[i])) return order[i];
  }
  return null;
}

/** Previous step in the configured order that the user can act on. */
export function resolve_previous_booking_step_id(
  order: readonly booking_step_id[],
  from: booking_step_id,
  states: booking_step_states
): booking_step_id | null {
  const index = booking_step_index(order, from);
  if (index <= 0) return null;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!is_booking_step_skippable(states, order[i])) return order[i];
  }
  return null;
}

/**
 * Progress steps worth showing: the current one plus every step the user still
 * has to act on, so skipped single-option steps never leave gaps in the count.
 */
export function visible_booking_step_ids(
  progress_ids: readonly booking_step_id[],
  current_step_id: booking_step_id,
  states: booking_step_states
): booking_step_id[] {
  const visible = progress_ids.filter(
    (id) => id === current_step_id || !is_booking_step_skippable(states, id)
  );
  return visible.length > 0 ? visible : [...progress_ids];
}

/** Whether event-type selection precedes department & provider in the configured order. */
export function is_event_type_before_department(
  order: readonly booking_step_id[]
): boolean {
  const event_idx = booking_step_index(order, 'event_type');
  const dept_idx = booking_step_index(order, 'department_provider');
  if (event_idx < 0 || dept_idx < 0) return false;
  return event_idx < dept_idx;
}

/** Department step is blocked until event-type is chosen when event-type comes first. */
export function department_step_is_ready(
  order: readonly booking_step_id[],
  selectedType: unknown
): boolean {
  if (!is_event_type_before_department(order)) return true;
  return selectedType != null;
}

export type event_type_step_context = {
  departmentsCount: number;
  hasSelectedDepartment: boolean;
  showProviderPicker: boolean;
  hasSelectedProvider: boolean;
};

export type event_type_step_state_context = {
  loadingEventTypes: boolean;
  eventTypesCount: number;
  hasSelectedType: boolean;
  contextReady: boolean;
};

/** Event-type step auto-advances when exactly one type is available and applied. */
export function event_type_step_state(
  context: event_type_step_state_context
): booking_step_state {
  return {
    requires_user_input:
      !context.loadingEventTypes && context.eventTypesCount !== 1,
    is_resolving:
      context.loadingEventTypes ||
      (context.eventTypesCount === 1 &&
        !context.hasSelectedType &&
        context.contextReady),
  };
}

/** Event-type step is blocked until department & provider are set when they come first. */
export function event_type_step_is_ready(
  order: readonly booking_step_id[],
  context: event_type_step_context
): boolean {
  if (is_event_type_before_department(order)) return true;
  if (context.departmentsCount === 0) return true;
  if (!context.hasSelectedDepartment) return false;
  if (context.showProviderPicker && !context.hasSelectedProvider) return false;
  return true;
}

/** Every configured progress step is always shown in the indicator. */
export function indicator_booking_step_ids(
  progress_ids: readonly booking_step_id[]
): booking_step_id[] {
  return [...progress_ids];
}

export type department_provider_step_context = {
  order: readonly booking_step_id[];
  selectedType: unknown;
  departmentsCount: number;
  loadingDepartments: boolean;
  hasSelectedDepartment: boolean;
  showProviderPicker: boolean;
  serviceProvidersCount: number;
  loadingProviders: boolean;
  hasSelectedProvider: boolean;
  providerCatalogContextReady: boolean;
  serviceCatalogReady: boolean;
  serviceRequiresManualSelection: boolean;
  serviceCatalogCount: number;
  hasSoleServiceSelected: boolean;
};

/**
 * Department & provider stays in the configured order always, but auto-advances
 * when there is exactly one department, one provider, and one service.
 */
export function department_provider_step_state(
  context: department_provider_step_context
): booking_step_state {
  const step_ready = department_step_is_ready(context.order, context.selectedType);

  if (!step_ready || context.departmentsCount === 0) {
    return { requires_user_input: true, is_resolving: false };
  }

  const sole_department = context.departmentsCount === 1;
  const sole_provider =
    !context.showProviderPicker || context.serviceProvidersCount === 1;

  // Multiple optional services still require this step; 0–1 services can auto-skip.
  const service_needs_choice =
    context.providerCatalogContextReady &&
    context.serviceCatalogReady &&
    context.serviceRequiresManualSelection;

  const can_auto_advance =
    sole_department && sole_provider && !service_needs_choice;

  if (!can_auto_advance) {
    return { requires_user_input: true, is_resolving: false };
  }

  const is_resolving =
    context.loadingDepartments ||
    (sole_department && !context.hasSelectedDepartment) ||
    (context.showProviderPicker &&
      context.serviceProvidersCount === 1 &&
      !context.hasSelectedProvider) ||
    context.loadingProviders ||
    (context.serviceCatalogReady &&
      context.serviceCatalogCount === 1 &&
      !context.hasSoleServiceSelected);

  return { requires_user_input: false, is_resolving };
}

/** Walk past every auto-skippable step from the current one (before paint). */
export function resolve_effective_booking_step_id(
  order: readonly booking_step_id[],
  from: booking_step_id,
  states: booking_step_states
): booking_step_id {
  let step = from;
  for (;;) {
    if (!is_booking_step_skippable(states, step)) return step;
    const next = resolve_next_booking_step_id(order, step, states);
    if (!next || next === step) return step;
    step = next;
  }
}
