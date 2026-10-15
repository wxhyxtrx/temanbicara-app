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

console.log("All settings diff checks passed!");
