import assert from "node:assert/strict";
import { fromLocalInput, isMaintenanceRangeValid, isValidLocalInput } from "./settings-form-parts";

// Run: npx tsx src/components/views/admin/settings/settings-dates.check.ts
assert.equal(isValidLocalInput("2026-10-20T01:00"), true);
assert.equal(isValidLocalInput(""), true);
assert.equal(fromLocalInput(""), null);
assert.equal(isValidLocalInput("2026-02-30T01:00"), false);
assert.equal(isValidLocalInput("2026-13-01T01:00"), false);
assert.equal(isValidLocalInput("2026-10-20T24:00"), false);
assert.equal(fromLocalInput("2026-02-30T01:00"), null);
assert.equal(typeof fromLocalInput("2026-10-20T01:00"), "string");
assert.equal(isMaintenanceRangeValid("2026-10-20T01:00", "2026-10-20T04:00"), true);
assert.equal(isMaintenanceRangeValid("2026-10-20T04:00", "2026-10-20T01:00"), false);
assert.equal(isMaintenanceRangeValid("2026-10-20T01:00", "2026-10-20T01:00"), false);
assert.equal(isMaintenanceRangeValid("", "2026-10-20T01:00"), true);
assert.equal(isMaintenanceRangeValid("2026-10-20T01:00", ""), true);
console.log("settings date checks passed");
