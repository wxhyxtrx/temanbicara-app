import assert from 'node:assert/strict';
import {
  scheduleSlotSchema,
  updateScheduleSchema,
  createTimeOffSchema,
} from '@/lib/validations/schedule';
import { updateMePsikologSchema } from '@/lib/validations/user';

// 1. scheduleSlotSchema
assert.equal(
  scheduleSlotSchema.safeParse({ weekday: 1, start_hour: 9, end_hour: 12 }).success,
  true,
  'Valid slot 09:00 - 12:00'
);
assert.equal(
  scheduleSlotSchema.safeParse({ weekday: 1, start_hour: 21, end_hour: 19 }).success,
  false,
  'end_hour < start_hour must fail'
);
assert.equal(
  scheduleSlotSchema.safeParse({ weekday: 1, start_hour: 10, end_hour: 10 }).success,
  false,
  'end_hour == start_hour must fail'
);
assert.equal(
  scheduleSlotSchema.safeParse({ weekday: 7, start_hour: 10, end_hour: 12 }).success,
  false,
  'weekday 7 must fail'
);
assert.equal(
  scheduleSlotSchema.safeParse({ weekday: -1, start_hour: 10, end_hour: 12 }).success,
  false,
  'weekday -1 must fail'
);

// 2. updateScheduleSchema
// Overlapping slots on same weekday
assert.equal(
  updateScheduleSchema.safeParse({
    weekly: [
      { weekday: 1, start_hour: 9, end_hour: 12 },
      { weekday: 1, start_hour: 11, end_hour: 14 },
    ],
  }).success,
  false,
  'Overlapping slots on Monday must fail'
);

// Adjacent / touching slots on same weekday (allowed)
assert.equal(
  updateScheduleSchema.safeParse({
    weekly: [
      { weekday: 1, start_hour: 9, end_hour: 11 },
      { weekday: 1, start_hour: 11, end_hour: 13 },
    ],
  }).success,
  true,
  'Touching slots 9-11 and 11-13 on Monday must pass'
);

// Slots on different weekdays with same hours (allowed)
assert.equal(
  updateScheduleSchema.safeParse({
    weekly: [
      { weekday: 1, start_hour: 9, end_hour: 12 },
      { weekday: 2, start_hour: 9, end_hour: 12 },
    ],
  }).success,
  true,
  'Same hours on different days must pass'
);

// Max 10 slots per day
const elevenSlots = Array.from({ length: 11 }, (_, i) => ({
  weekday: 1,
  start_hour: i * 2,
  end_hour: i * 2 + 1,
}));
assert.equal(
  updateScheduleSchema.safeParse({ weekly: elevenSlots }).success,
  false,
  '>10 slots per day must fail'
);

// 3. createTimeOffSchema
assert.equal(
  createTimeOffSchema.safeParse({
    start_at: '2026-10-20T08:00:00+07:00',
    end_at: '2026-10-20T17:00:00+07:00',
    reason: 'Cuti',
  }).success,
  true,
  'Valid time off range'
);
assert.equal(
  createTimeOffSchema.safeParse({
    start_at: '2026-10-20T17:00:00+07:00',
    end_at: '2026-10-20T08:00:00+07:00',
  }).success,
  false,
  'end_at <= start_at must fail'
);

// 4. updateMePsikologSchema
assert.equal(
  updateMePsikologSchema.safeParse({
    booking_paused: true,
    extension_price_coins: 5,
  }).success,
  true,
  'booking_paused and extension_price_coins valid'
);
assert.equal(
  updateMePsikologSchema.safeParse({
    extension_price_coins: null,
  }).success,
  true,
  'extension_price_coins nullable'
);
assert.equal(
  updateMePsikologSchema.safeParse({
    extension_price_coins: 0,
  }).success,
  false,
  'extension_price_coins must be positive'
);

console.log('All schedule validation checks passed!');
