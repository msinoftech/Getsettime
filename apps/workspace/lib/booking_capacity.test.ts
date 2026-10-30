import { strict as assert } from 'node:assert';
import {
  evaluate_slot_occupancy,
  flatten_embed_booking_row,
  is_time_range_at_capacity_for_event,
  remaining_seats_for_event,
  type slot_occupancy_booking,
  type slot_occupancy_context,
} from './booking_capacity';

const group_context: slot_occupancy_context = {
  event_type_id: 262,
  capacity: 10,
  is_group: true,
};

const slot_start = new Date('2026-10-06T03:35:00.000Z');
const slot_end = new Date('2026-10-06T04:05:00.000Z');

function same_group_booking(id: number): slot_occupancy_booking {
  return {
    id,
    start_at: '2026-10-06T03:35:00.000Z',
    end_at: '2026-10-06T04:05:00.000Z',
    status: 'confirmed',
    event_type_id: 262,
    event_type_format: 'group_class',
    capacity_per_slot: 10,
  };
}

assert.equal(
  remaining_seats_for_event(slot_start, slot_end, [same_group_booking(411)], group_context, 10),
  9
);
assert.equal(
  is_time_range_at_capacity_for_event(
    slot_start,
    slot_end,
    [same_group_booking(411)],
    group_context,
    10
  ),
  false
);

assert.equal(
  remaining_seats_for_event(
    slot_start,
    slot_end,
    [
      {
        start_at: '2026-10-06T03:35:00.000Z',
        end_at: '2026-10-06T04:05:00.000Z',
        status: 'confirmed',
      },
    ],
    group_context,
    10
  ),
  9
);

assert.equal(
  evaluate_slot_occupancy(slot_start, slot_end, [
    {
      start_at: '2026-10-06T03:35:00.000Z',
      end_at: '2026-10-06T04:05:00.000Z',
      status: 'confirmed',
      event_type_id: 256,
      event_type_format: 'one_on_one',
    },
  ], group_context).blocked,
  true
);

assert.equal(
  remaining_seats_for_event(
    slot_start,
    slot_end,
    [
      same_group_booking(411),
      {
        start_at: '2026-10-06T03:35:30.000Z',
        end_at: '2026-10-06T04:05:30.000Z',
        status: 'confirmed',
        occupancy_source: 'calendar',
      },
    ],
    group_context,
    10
  ),
  9
);

const sep_24_slot_start = new Date('2026-09-24T08:00:00.000Z');
const sep_24_slot_end = new Date('2026-09-24T08:30:00.000Z');
assert.equal(
  remaining_seats_for_event(
    sep_24_slot_start,
    sep_24_slot_end,
    [
      {
        id: 501,
        start_at: '2026-09-24T08:00:00.000Z',
        end_at: '2026-09-24T08:30:00.000Z',
        status: 'confirmed',
        event_type_id: 262,
      },
      {
        start_at: '2026-09-24T08:00:00.000Z',
        end_at: '2026-09-24T09:00:00.000Z',
        status: 'confirmed',
        occupancy_source: 'calendar',
      },
    ],
    group_context,
    10
  ),
  9
);

assert.equal(
  remaining_seats_for_event(
    sep_24_slot_start,
    sep_24_slot_end,
    [
      {
        id: 414,
        start_at: '2026-09-24T08:00:00.000Z',
        end_at: '2026-09-24T08:30:00.000Z',
        status: 'confirmed',
        event_type_id: 262,
      },
      {
        start_at: '2026-09-24T08:00:00.000Z',
        end_at: '2026-09-24T08:30:00.000Z',
        status: 'confirmed',
        occupancy_source: 'calendar',
      },
    ],
    null,
    10
  ),
  9
);

const flattened = flatten_embed_booking_row({
  id: 414,
  start_at: '2026-09-24T08:00:00+00:00',
  end_at: '2026-09-24T08:30:00+00:00',
  status: 'confirmed',
  service_provider_id: '879855c2-4e9e-4e6b-85a6-fb2db4ecebc1',
  event_type_id: 262,
  event_types: {
    event_type_format: 'group_class',
    capacity_per_slot: 10,
    recurrence: { audience: 'single' },
  },
});
assert.equal(flattened.service_provider_id, '879855c2-4e9e-4e6b-85a6-fb2db4ecebc1');

console.log('booking_capacity tests passed');
