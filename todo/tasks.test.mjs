import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, parseTags, todayISO, isOverdue, sortTasks, filterTasks, allTags, applyRepeat, nextOccurrence, PRIORITIES, normalizePriority } from "./tasks.js";

const t = (id, extra = {}) => normalize({ id, title: `t${id}`, done: false, createdAt: id, ...extra });

test("normalize gives old tasks empty due date, tags and no repeat", () => {
  assert.deepEqual(normalize({ id: 1, title: "old", done: false }), {
    id: 1, title: "old", done: false, dueDate: null, tags: [], repeat: null, priority: null,
  });
});

test("applyRepeat: recurring task with no date gets today; monthly remembers its day", () => {
  assert.deepEqual(applyRepeat({ dueDate: null, repeat: { freq: "daily" } }, "2026-10-26"),
    { dueDate: "2026-10-26", repeat: { freq: "daily" } });
  assert.deepEqual(applyRepeat({ dueDate: "2027-01-31", repeat: { freq: "monthly" } }, "2026-10-26"),
    { dueDate: "2027-01-31", repeat: { freq: "monthly", anchorDay: 31 } });
  assert.deepEqual(applyRepeat({ dueDate: null, repeat: { freq: "none" } }, "2026-10-26"),
    { dueDate: null, repeat: null });
});

test("nextOccurrence copies title, tags and repeat; new date; not done; no id", () => {
  const done = normalize({ id: 7, title: "Gym", done: true, dueDate: "2026-10-26", tags: ["health"],
    repeat: { freq: "everyN", n: 2 }, createdAt: 1 });
  const next = nextOccurrence(done, "2026-10-26", 999);
  assert.deepEqual(next, { title: "Gym", done: false, dueDate: "2026-10-28", tags: ["health"],
    repeat: { freq: "everyN", n: 2 }, priority: null, createdAt: 999 });
});

test("nextOccurrence is null once this task already created its next copy (re-tick after un-tick)", () => {
  const t1 = normalize({ id: 3, title: "Gym", done: true, dueDate: "2026-10-26", repeat: { freq: "daily" }, spawnedNext: true });
  assert.equal(nextOccurrence(t1, "2026-10-26"), null);
});

test("nextOccurrence is null for non-recurring tasks", () => {
  assert.equal(nextOccurrence(normalize({ id: 1, title: "x", done: true, dueDate: "2026-10-26" }), "2026-10-26"), null);
});

test("parseTags trims, lower-cases, drops blanks and duplicates", () => {
  assert.deepEqual(parseTags(" Work, urgent,,work , HOME "), ["work", "urgent", "home"]);
  assert.deepEqual(parseTags(""), []);
  assert.deepEqual(parseTags(undefined), []);
});

test("todayISO pads month and day", () => {
  assert.equal(todayISO(new Date(2026, 0, 5)), "2026-01-05");
});

test("isOverdue only for past-due, not-done tasks", () => {
  const today = "2026-10-26";
  assert.equal(isOverdue(t(1, { dueDate: "2026-10-25" }), today), true);
  assert.equal(isOverdue(t(2, { dueDate: "2026-10-26" }), today), false);
  assert.equal(isOverdue(t(3, { dueDate: "2026-10-25", done: true }), today), false);
  assert.equal(isOverdue(t(4), today), false);
});

test("sortTasks: soonest due first, undated last, ties by creation", () => {
  const tasks = [t(1), t(2, { dueDate: "2026-11-01" }), t(3, { dueDate: "2026-10-01" }), t(4), t(5, { dueDate: "2026-10-01" })];
  assert.deepEqual(sortTasks(tasks).map((x) => x.id), [3, 5, 2, 1, 4]);
});

test("sortTasks: dated before undated regardless of input order", () => {
  const tasks = [t(1, { dueDate: "2026-11-01" }), t(2)];
  assert.deepEqual(sortTasks(tasks).map((x) => x.id), [1, 2]);
  assert.deepEqual(sortTasks([...tasks].reverse()).map((x) => x.id), [1, 2]);
  // Mixed order so the comparator sees (dated, undated) as well as (undated, dated).
  const mixed = [t(3), t(4, { dueDate: "2026-10-01" }), t(5), t(6, { dueDate: "2026-09-01" })];
  assert.deepEqual(sortTasks(mixed).map((x) => x.id), [6, 4, 3, 5]);
});

test("sortTasks: two dated tasks sort by date in either input order", () => {
  const early = t(1, { dueDate: "2026-09-01" }), late = t(2, { dueDate: "2026-10-01" });
  assert.deepEqual(sortTasks([early, late]).map((x) => x.id), [1, 2]);
  assert.deepEqual(sortTasks([late, early]).map((x) => x.id), [1, 2]);
});

test("sortTasks: tasks with no createdAt sort before ones that have it on a tie", () => {
  const noTime = normalize({ id: 9, title: "old", done: false });
  assert.deepEqual(sortTasks([t(5), noTime]).map((x) => x.id), [9, 5]);
  assert.deepEqual(sortTasks([noTime, t(5)]).map((x) => x.id), [9, 5]);
});

test("filterTasks combines status and tag", () => {
  const tasks = [t(1, { tags: ["work"] }), t(2, { tags: ["work"], done: true }), t(3, { tags: ["home"] })];
  const ids = (f) => filterTasks(tasks, f).map((x) => x.id);
  assert.deepEqual(ids({ status: "all" }), [1, 2, 3]);
  assert.deepEqual(ids({ status: "active" }), [1, 3]);
  assert.deepEqual(ids({ status: "completed" }), [2]);
  assert.deepEqual(ids({ tag: "work" }), [1, 2]);
  assert.deepEqual(ids({ status: "active", tag: "work" }), [1]);
});

test("allTags is sorted and unique", () => {
  assert.deepEqual(allTags([t(1, { tags: ["work", "b"] }), t(2, { tags: ["a", "work"] })]), ["a", "b", "work"]);
});

test("normalizePriority: only high/medium/low survive; anything else is no priority", () => {
  assert.deepEqual(PRIORITIES, ["high", "medium", "low"]);
  for (const p of PRIORITIES) assert.equal(normalizePriority(p), p);
  for (const p of [undefined, null, "", "urgent", "HIGH", 1]) assert.equal(normalizePriority(p), null);
  assert.equal(normalize({ id: 1, title: "x", done: false, priority: "urgent" }).priority, null);
  assert.equal(normalize({ id: 1, title: "x", done: false, priority: "low" }).priority, "low");
});

test("sortTasks: same date breaks ties High > Medium > Low > none, then creation", () => {
  const tasks = [
    t(1, { dueDate: "2026-10-01" }), t(2, { dueDate: "2026-10-01", priority: "low" }),
    t(3, { dueDate: "2026-10-01", priority: "high" }), t(4, { dueDate: "2026-10-01", priority: "medium" }),
    t(5, { dueDate: "2026-09-01", priority: "low" }), t(6, { dueDate: "2026-10-01", priority: "high" }),
    t(7, { priority: "high" }), t(8),
  ];
  assert.deepEqual(sortTasks(tasks).map((x) => x.id), [5, 3, 6, 4, 2, 1, 7, 8]);
});

test("filterTasks: priority filter combines with status and tag", () => {
  const tasks = [t(1, { priority: "high", tags: ["work"] }), t(2, { priority: "high", done: true, tags: ["work"] }),
    t(3, { priority: "low", tags: ["work"] }), t(4)];
  const ids = (f) => filterTasks(tasks, f).map((x) => x.id);
  assert.deepEqual(ids({ priority: "all" }), [1, 2, 3, 4]);
  assert.deepEqual(ids({}), [1, 2, 3, 4]);
  assert.deepEqual(ids({ priority: "high" }), [1, 2]);
  assert.deepEqual(ids({ priority: "low" }), [3]);
  assert.deepEqual(ids({ priority: "high", status: "active", tag: "work" }), [1]);
});

test("nextOccurrence keeps the priority", () => {
  const done = normalize({ id: 7, title: "Gym", done: true, dueDate: "2026-10-26", repeat: { freq: "daily" }, priority: "high" });
  assert.equal(nextOccurrence(done, "2026-10-26", 1).priority, "high");
  const plain = normalize({ id: 8, title: "Walk", done: true, dueDate: "2026-10-26", repeat: { freq: "daily" } });
  assert.equal(nextOccurrence(plain, "2026-10-26", 1).priority, null);
});
