import assert from 'node:assert/strict';

// 1. UUID validation check
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
assert.equal(UUID_RE.test('e1000000-0000-0000-0000-000000000001'), true);
assert.equal(UUID_RE.test('invalid-uuid'), false);

// 2. Date format check (YYYY-MM-DD)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
assert.equal(DATE_RE.test('2026-10-18'), true);
assert.equal(DATE_RE.test('2026-1-1'), false);
assert.equal(DATE_RE.test('18-10-2026'), false);
assert.equal(DATE_RE.test('2026-10-18T00:00:00'), false);

// 3. Days range check (integer 1..14)
function isValidDays(val: unknown): boolean {
  const n = Number(val);
  return Number.isInteger(n) && n >= 1 && n <= 14;
}
assert.equal(isValidDays(7), true);
assert.equal(isValidDays(1), true);
assert.equal(isValidDays(14), true);
assert.equal(isValidDays(0), false);
assert.equal(isValidDays(15), false);
assert.equal(isValidDays('abc'), false);
assert.equal(isValidDays(3.5), false);

// 4. WIB date calculation
const sampleDate = new Date('2026-10-18T17:00:00.000Z'); // 17:00 UTC = 00:00 WIB next day (Oct 19)
const wibFormatted = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(sampleDate);
assert.equal(wibFormatted, '2026-10-19', '17:00 UTC must format to 2026-10-19 in Asia/Jakarta');

// 5. Sunday 23:00 WIB boundary test (Review Focus #2)
// Slot Minggu 23.00 WIB = Minggu 16.00 UTC
const sundayWib = new Date('2026-10-18T23:00:00+07:00');
const sundayUtcIso = sundayWib.toISOString();
assert.equal(sundayUtcIso, '2026-10-18T16:00:00.000Z', '23:00 WIB is 16:00 UTC on same date');
const dayOfWeekWib = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(sundayWib);
assert.equal(dayOfWeekWib, 'Sun', 'Must be Sunday in WIB');
const hourWib = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(sundayWib);
assert.equal(hourWib, '23', 'Must be hour 23 in WIB');

// 6. Range calculation test (7 days span)
const startDate = new Date('2026-10-18T00:00:00+07:00');
const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
assert.equal(endDate.toISOString(), '2026-10-24T17:00:00.000Z'); // 2026-10-25 00:00:00+07:00

console.log('All available slots checks passed!');
