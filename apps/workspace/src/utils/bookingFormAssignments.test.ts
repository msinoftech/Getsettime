import { strict as assert } from 'node:assert';
import {
  filterDepartmentsForEventType,
  filterEventTypesForServiceProvider,
  filterProvidersForEventType,
} from './bookingFormUtils';
import type { Department } from '@/src/types/bookingForm';

const OWNER = '11111111-1111-1111-1111-111111111111';
const PROVIDER_A = '22222222-2222-2222-2222-222222222222';
const PROVIDER_B = '33333333-3333-3333-3333-333333333333';

const departments = [
  { id: 277, name: 'Cardiology', description: null, status: 'active' },
  { id: 288, name: 'Dermatology', description: null, status: 'active' },
] as unknown as Department[];

const providers = [{ id: OWNER }, { id: PROVIDER_A }, { id: PROVIDER_B }];

function runDepartmentScopeTests(): void {
  assert.deepEqual(
    filterDepartmentsForEventType(departments, { department_id: 288 }).map((d) => d.id),
    [288]
  );

  // Legacy event types carry no assignment, so every department stays bookable.
  assert.equal(filterDepartmentsForEventType(departments, { department_id: null }).length, 2);
  assert.equal(filterDepartmentsForEventType(departments, null).length, 2);

  // Ids arrive as text from public selects.
  assert.deepEqual(
    filterDepartmentsForEventType(departments, { department_id: '277' }).map((d) => d.id),
    [277]
  );
}

function runProviderScopeTests(): void {
  assert.deepEqual(
    filterProvidersForEventType(providers, {
      service_provider_ids: [PROVIDER_A],
      owner_id: OWNER,
    }).map((p) => p.id),
    [PROVIDER_A]
  );

  // Without an explicit list the owner is the only assigned host.
  assert.deepEqual(
    filterProvidersForEventType(providers, {
      service_provider_ids: [],
      owner_id: OWNER,
    }).map((p) => p.id),
    [OWNER]
  );

  assert.equal(filterProvidersForEventType(providers, null).length, 3);
}

function runEventTypeScopeTests(): void {
  const assigned_to_a = { id: 'a', service_provider_ids: [PROVIDER_A], owner_id: OWNER };
  const owned_only = { id: 'b', service_provider_ids: [], owner_id: OWNER };
  const event_types = [assigned_to_a, owned_only];

  // An assigned host sees the type even when someone else owns it.
  assert.deepEqual(
    filterEventTypesForServiceProvider(event_types, PROVIDER_A).map((et) => et.id),
    ['a']
  );
  // The owner loses access once the type is assigned to other hosts.
  assert.deepEqual(
    filterEventTypesForServiceProvider(event_types, OWNER).map((et) => et.id),
    ['b']
  );
  assert.deepEqual(
    filterEventTypesForServiceProvider(event_types, PROVIDER_B).map((et) => et.id),
    []
  );
  assert.equal(filterEventTypesForServiceProvider(event_types, null).length, 2);
}

runDepartmentScopeTests();
runProviderScopeTests();
runEventTypeScopeTests();
console.log('booking form assignment scoping tests passed');
