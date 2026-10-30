import { strict as assert } from 'node:assert';
import {
  DEFAULT_BOOKING_STEP_ORDER,
  parse_booking_step_order,
  progress_booking_step_ids,
  type booking_step_id,
} from './booking_step';
import { previous_booking_step_id } from './booking_step';
import {
  department_provider_step_state,
  department_step_is_ready,
  event_type_step_is_ready,
  event_type_step_state,
  indicator_booking_step_ids,
  is_booking_step_resolving,
  is_booking_step_skippable,
  is_event_type_before_department,
  resolve_effective_booking_step_id,
  resolve_next_booking_step_id,
  resolve_previous_booking_step_id,
  visible_booking_step_ids,
  type booking_step_states,
} from './booking_step_resolution';

const ORDER: readonly booking_step_id[] = DEFAULT_BOOKING_STEP_ORDER;

const settled = { requires_user_input: false, is_resolving: false };
const needs_user = { requires_user_input: true, is_resolving: false };
const loading = { requires_user_input: false, is_resolving: true };

function runNextStepTests(): void {
  // Several event types: the user picks, so the step is shown.
  assert.equal(
    resolve_next_booking_step_id(ORDER, 'event_type', {
      event_type: needs_user,
      department_provider: needs_user,
    }),
    'department_provider'
  );

  // Sole department, provider, and service auto-advance past the step.
  assert.equal(
    resolve_next_booking_step_id(ORDER, 'event_type', {
      event_type: settled,
      department_provider: settled,
    }),
    'date_time'
  );

  // Still loading the sole option: stop there and show the loader.
  assert.equal(
    resolve_next_booking_step_id(ORDER, 'event_type', {
      event_type: settled,
      department_provider: loading,
    }),
    'department_provider'
  );

  // Date/time and intake always need the user, and success is never auto-entered.
  assert.equal(resolve_next_booking_step_id(ORDER, 'date_time', {}), 'intake');
  assert.equal(resolve_next_booking_step_id(ORDER, 'intake', {}), 'success');
  assert.equal(resolve_next_booking_step_id(ORDER, 'success', {}), null);
}

function runPreviousStepTests(): void {
  assert.equal(
    resolve_previous_booking_step_id(ORDER, 'date_time', {
      event_type: needs_user,
      department_provider: needs_user,
    }),
    'department_provider'
  );

  assert.equal(
    resolve_previous_booking_step_id(ORDER, 'date_time', {
      event_type: needs_user,
      department_provider: needs_user,
    }),
    'department_provider'
  );

  // Auto back skips every settled step; manual back uses previous_booking_step_id.
  assert.equal(
    resolve_previous_booking_step_id(ORDER, 'date_time', {
      event_type: settled,
      department_provider: settled,
    }),
    null
  );
}

function runStepVisibilityTests(): void {
  const states: booking_step_states = {
    event_type: needs_user,
    department_provider: settled,
  };
  const progress_ids = progress_booking_step_ids(ORDER);

  assert.deepEqual(visible_booking_step_ids(progress_ids, 'date_time', states), [
    'event_type',
    'date_time',
    'intake',
  ]);

  assert.deepEqual(
    visible_booking_step_ids(progress_ids, 'department_provider', states),
    ['event_type', 'department_provider', 'date_time', 'intake']
  );

  assert.equal(is_booking_step_skippable(states, 'department_provider'), true);
  assert.equal(is_booking_step_skippable(states, 'event_type'), false);
  assert.equal(is_booking_step_skippable(states, 'date_time'), false);

  assert.equal(
    is_booking_step_resolving({ department_provider: loading }, 'department_provider'),
    true
  );
  assert.equal(
    is_booking_step_resolving({ event_type: loading }, 'event_type'),
    true
  );
}

function runEventTypeStepStateTests(): void {
  assert.deepEqual(
    event_type_step_state({
      loadingEventTypes: false,
      eventTypesCount: 1,
      hasSelectedType: true,
      contextReady: true,
    }),
    settled
  );

  assert.equal(
    event_type_step_state({
      loadingEventTypes: false,
      eventTypesCount: 1,
      hasSelectedType: false,
      contextReady: true,
    }).is_resolving,
    true
  );

  assert.equal(
    event_type_step_state({
      loadingEventTypes: false,
      eventTypesCount: 2,
      hasSelectedType: false,
      contextReady: true,
    }).requires_user_input,
    true
  );

  assert.equal(
    event_type_step_state({
      loadingEventTypes: true,
      eventTypesCount: 1,
      hasSelectedType: false,
      contextReady: false,
    }).is_resolving,
    true
  );
}

function runDepartmentStepStateTests(): void {
  const settled_context = {
    order: ORDER,
    selectedType: { id: '1' },
    departmentsCount: 1,
    loadingDepartments: false,
    hasSelectedDepartment: true,
    showProviderPicker: true,
    serviceProvidersCount: 1,
    loadingProviders: false,
    hasSelectedProvider: true,
    providerCatalogContextReady: true,
    serviceCatalogReady: true,
    serviceRequiresManualSelection: false,
    serviceCatalogCount: 1,
    hasSoleServiceSelected: true,
  };

  assert.deepEqual(department_provider_step_state(settled_context), settled);

  assert.equal(
    department_provider_step_state({
      ...settled_context,
      serviceProvidersCount: 2,
    }).requires_user_input,
    true
  );

  assert.equal(
    department_provider_step_state({
      ...settled_context,
      serviceCatalogCount: 2,
      serviceRequiresManualSelection: true,
    }).requires_user_input,
    true
  );

  assert.equal(
    department_provider_step_state({
      ...settled_context,
      hasSelectedDepartment: false,
    }).is_resolving,
    true
  );
}

function runEffectiveStepTests(): void {
  assert.equal(
    resolve_effective_booking_step_id(ORDER, 'event_type', {
      event_type: settled,
      department_provider: settled,
    }),
    'date_time'
  );

  assert.equal(
    resolve_effective_booking_step_id(ORDER, 'event_type', {
      event_type: settled,
      department_provider: loading,
    }),
    'department_provider'
  );

  assert.equal(
    resolve_effective_booking_step_id(ORDER, 'date_time', {
      event_type: settled,
      department_provider: settled,
    }),
    'date_time'
  );
}

function runManualNavigationTests(): void {
  assert.equal(previous_booking_step_id(ORDER, 'date_time'), 'department_provider');
  assert.equal(previous_booking_step_id(ORDER, 'department_provider'), 'event_type');
  assert.equal(previous_booking_step_id(ORDER, 'event_type'), null);

  const progress_ids = progress_booking_step_ids(ORDER);
  assert.deepEqual(indicator_booking_step_ids(progress_ids), progress_ids);

  assert.equal(is_event_type_before_department(ORDER), true);
  assert.equal(department_step_is_ready(ORDER, null), false);
  assert.equal(department_step_is_ready(ORDER, { id: '1' }), true);

  const dept_first: readonly booking_step_id[] = [
    'department_provider',
    'event_type',
    'date_time',
    'intake',
    'success',
  ];
  assert.equal(is_event_type_before_department(dept_first), false);
  assert.equal(department_step_is_ready(dept_first, null), true);
  assert.equal(
    event_type_step_is_ready(dept_first, {
      departmentsCount: 2,
      hasSelectedDepartment: false,
      showProviderPicker: true,
      hasSelectedProvider: false,
    }),
    false
  );
  assert.equal(
    event_type_step_is_ready(dept_first, {
      departmentsCount: 2,
      hasSelectedDepartment: true,
      showProviderPicker: true,
      hasSelectedProvider: true,
    }),
    true
  );
}

function runStepOrderParsingTests(): void {
  assert.deepEqual(parse_booking_step_order(['event_type', 'date_time', 'intake']), [
    'event_type',
    'date_time',
    'intake',
    'success',
  ]);

  // Steps placed after the success screen would be unreachable.
  assert.equal(
    parse_booking_step_order(['date_time', 'success', 'intake']),
    null
  );
  assert.equal(parse_booking_step_order(['event_type', 'date_time']), null);
  assert.equal(parse_booking_step_order(['date_time', 'date_time', 'intake']), null);
}

runNextStepTests();
runPreviousStepTests();
runStepVisibilityTests();
runEventTypeStepStateTests();
runDepartmentStepStateTests();
runEffectiveStepTests();
runManualNavigationTests();
runStepOrderParsingTests();
console.log('booking_step_resolution tests passed');
