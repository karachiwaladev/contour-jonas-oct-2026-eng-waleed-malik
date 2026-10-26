import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRepeat, stepDate, nextDueDate, repeatLabel } from "./recurrence.js";

test("normalizeRepeat: none/unknown/missing mean not recurring", () => {
  assert.equal(normalizeRepeat(undefined), null);
  assert.equal(normalizeRepeat(null), null);
  assert.equal(normalizeRepeat({ freq: "none" }), null);
  assert.equal(normalizeRepeat({ freq: "hourly" }), null);
});

test("normalizeRepeat: every-N needs a whole number >= 1", () => {
  assert.deepEqual(normalizeRepeat({ freq: "everyN", n: "3" }), { freq: "everyN", n: 3 });
  assert.deepEqual(normalizeRepeat({ freq: "everyN", n: 0 }), { freq: "everyN", n: 1 });
  assert.deepEqual(normalizeRepeat({ freq: "everyN", n: "abc" }), { freq: "everyN", n: 1 });
});

test("normalizeRepeat: monthly without a day keeps no anchor; daily/weekly drop stray fields", () => {
  assert.deepEqual(normalizeRepeat({ freq: "monthly" }), { freq: "monthly" });
  assert.deepEqual(normalizeRepeat({ freq: "monthly", anchorDay: 15 }), { freq: "monthly", anchorDay: 15 });
  assert.deepEqual(normalizeRepeat({ freq: "weekly", n: 9, anchorDay: 3 }), { freq: "weekly" });
});

test("stepDate: unknown frequency throws instead of guessing", () => {
  assert.throws(() => stepDate("2026-10-26", { freq: "yearly" }), /Unknown repeat: yearly/);
});

test("stepDate: monthly with no anchor uses the date's own day", () => {
  assert.equal(stepDate("2026-10-15", { freq: "monthly" }), "2026-11-15");
});

test("stepDate: daily, weekly, every N days", () => {
  assert.equal(stepDate("2026-10-26", { freq: "daily" }), "2026-10-27");
  assert.equal(stepDate("2026-10-26", { freq: "weekly" }), "2026-11-02");
  assert.equal(stepDate("2026-10-30", { freq: "everyN", n: 3 }), "2026-11-02");
});

test("stepDate: crosses year end", () => {
  assert.equal(stepDate("2026-12-31", { freq: "daily" }), "2027-01-01");
  assert.equal(stepDate("2026-12-15", { freq: "monthly", anchorDay: 15 }), "2027-01-15");
});

test("stepDate: monthly clamps to month end but returns to the anchor day", () => {
  const r = { freq: "monthly", anchorDay: 31 };
  assert.equal(stepDate("2027-01-31", r), "2027-02-28");
  assert.equal(stepDate("2027-02-28", r), "2027-03-31");
  assert.equal(stepDate("2027-03-31", r), "2027-04-30");
});

test("stepDate: monthly in a leap year lands on Feb 29", () => {
  assert.equal(stepDate("2028-01-31", { freq: "monthly", anchorDay: 31 }), "2028-02-29");
  assert.equal(stepDate("2028-01-29", { freq: "monthly", anchorDay: 29 }), "2028-02-29");
});

test("nextDueDate: steps from the due date, not today, when on time", () => {
  assert.equal(nextDueDate("2026-10-26", { freq: "weekly" }, "2026-10-26"), "2026-11-02");
  assert.equal(nextDueDate("2026-10-30", { freq: "daily" }, "2026-10-26"), "2026-10-31");
});

test("nextDueDate: skips ahead to the first date on or after today when finished late", () => {
  // Weekly from Monday 2026-10-12, finished on Monday 2026-10-26: next is today, not 10-19.
  assert.equal(nextDueDate("2026-10-12", { freq: "weekly" }, "2026-10-26"), "2026-10-26");
  assert.equal(nextDueDate("2026-10-01", { freq: "daily" }, "2026-10-26"), "2026-10-26");
  assert.equal(nextDueDate("2026-10-12", { freq: "weekly" }, "2026-10-27"), "2026-11-02");
});

test("repeatLabel", () => {
  assert.equal(repeatLabel(null), "");
  assert.equal(repeatLabel({ freq: "daily" }), "daily");
  assert.equal(repeatLabel({ freq: "weekly" }), "weekly");
  assert.equal(repeatLabel({ freq: "monthly", anchorDay: 31 }), "monthly");
  assert.equal(repeatLabel({ freq: "everyN", n: 1 }), "every day");
  assert.equal(repeatLabel({ freq: "everyN", n: 3 }), "every 3 days");
});
