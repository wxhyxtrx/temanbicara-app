import assert from "node:assert/strict";
import { DEFAULT_SYSTEM_SETTINGS } from "@/constant/system-settings";
import { getChangedSettings, toLocalInput } from "./settings-form-parts";
import type { SystemSettings } from "@/types/system-settings";

// 1. Initial / identical -> no changes
const orig: SystemSettings = JSON.parse(JSON.stringify(DEFAULT_SYSTEM_SETTINGS));
const form: SystemSettings = JSON.parse(JSON.stringify(DEFAULT_SYSTEM_SETTINGS));
const maintDraft = {
  scheduled_start: toLocalInput(orig.maintenance.scheduled_start),
  estimated_end: toLocalInput(orig.maintenance.estimated_end),
};

const changes0 = getChangedSettings(form, orig, maintDraft, null);
assert.deepEqual(changes0, {}, "No changes when form matches original");

// 2. Change topup only
form.topup = { min_coins: 15, max_coins: 500 };
const changes1 = getChangedSettings(form, orig, maintDraft, null);
assert.deepEqual(changes1, { topup: { min_coins: 15, max_coins: 500 } }, "Detects topup changes only");

// Revert topup back
form.topup = { min_coins: 10, max_coins: 500 };
const changesReverted = getChangedSettings(form, orig, maintDraft, null);
assert.deepEqual(changesReverted, {}, "Reverting topup clears changes");

// 3. Change maintenance message only
form.maintenance.message = "Server restart in 10 minutes";
const changes2 = getChangedSettings(form, orig, maintDraft, null);
assert.equal(changes2.maintenance?.message, "Server restart in 10 minutes");
assert.equal(Object.keys(changes2).length, 1);
form.maintenance.message = "";

// 4. Change revenue_share draft
const changes3 = getChangedSettings(form, orig, maintDraft, "85");
assert.deepEqual(changes3, { revenue_share: { mitra_bps: 8500 } });

// Revert revenue_share draft to 80
const changes3Revert = getChangedSettings(form, orig, maintDraft, "80");
assert.deepEqual(changes3Revert, {});

// 5. Change refund_policy
form.refund_policy[0].refund_pct = 90;
const changes4 = getChangedSettings(form, orig, maintDraft, null);
assert.equal(changes4.refund_policy?.[0].refund_pct, 90);
assert.equal(Object.keys(changes4).length, 1);
form.refund_policy[0].refund_pct = orig.refund_policy[0].refund_pct;

// 6. Change booking setting
form.booking.max_active_per_patient = 5;
const changesBooking = getChangedSettings(form, orig, maintDraft, null);
assert.deepEqual(changesBooking, { booking: { ...orig.booking, max_active_per_patient: 5 } });
form.booking.max_active_per_patient = orig.booking.max_active_per_patient;

// 7. Change strike setting
form.strike.threshold = 4;
const changesStrike = getChangedSettings(form, orig, maintDraft, null);
assert.deepEqual(changesStrike, { strike: { ...orig.strike, threshold: 4 } });
form.strike.threshold = orig.strike.threshold;

// 8. Change rating setting
form.rating.min_count_to_show = 5;
const changesRating = getChangedSettings(form, orig, maintDraft, null);
assert.deepEqual(changesRating, { rating: { ...orig.rating, min_count_to_show: 5 } });
form.rating.min_count_to_show = orig.rating.min_count_to_show;

// 9. Zod validation checks for booking, strike, rating
import {
  bookingSchema,
  strikeSchema,
  ratingSchema,
  systemSettingsValidators,
} from "@/lib/validations/system-settings";

// Default values must pass
assert.equal(bookingSchema.safeParse(DEFAULT_SYSTEM_SETTINGS.booking).success, true);
assert.equal(strikeSchema.safeParse(DEFAULT_SYSTEM_SETTINGS.strike).success, true);
assert.equal(ratingSchema.safeParse(DEFAULT_SYSTEM_SETTINGS.rating).success, true);

// Boundary checks:
// min_hours_before >= 1
assert.equal(bookingSchema.safeParse({ ...DEFAULT_SYSTEM_SETTINGS.booking, min_hours_before: 0 }).success, false);
// psikolog_cancel_free_hours >= 0 (0 is valid)
assert.equal(bookingSchema.safeParse({ ...DEFAULT_SYSTEM_SETTINGS.booking, psikolog_cancel_free_hours: 0 }).success, true);
// psikolog_cancel_free_hours < 0 (negative is invalid)
assert.equal(bookingSchema.safeParse({ ...DEFAULT_SYSTEM_SETTINGS.booking, psikolog_cancel_free_hours: -1 }).success, false);
// max_days_ahead * 24 > min_hours_before
assert.equal(bookingSchema.safeParse({ ...DEFAULT_SYSTEM_SETTINGS.booking, max_days_ahead: 1, min_hours_before: 24 }).success, false);
assert.equal(bookingSchema.safeParse({ ...DEFAULT_SYSTEM_SETTINGS.booking, max_days_ahead: 2, min_hours_before: 24 }).success, true);
// strike.threshold >= 1
assert.equal(strikeSchema.safeParse({ ...DEFAULT_SYSTEM_SETTINGS.strike, threshold: 0 }).success, false);
// rating.min_count_to_show >= 1
assert.equal(ratingSchema.safeParse({ ...DEFAULT_SYSTEM_SETTINGS.rating, min_count_to_show: 0 }).success, false);

// Registered in systemSettingsValidators
assert.ok("booking" in systemSettingsValidators);
assert.ok("strike" in systemSettingsValidators);
assert.ok("rating" in systemSettingsValidators);

console.log("All settings diff checks passed!");
