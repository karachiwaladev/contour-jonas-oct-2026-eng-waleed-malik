import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, parseTags, todayISO, isOverdue, sortTasks, filterTasks, allTags } from "./tasks.js";

const t = (id, extra = {}) => normalize({ id, title: `t${id}`, done: false, createdAt: id, ...extra });

test("normalize gives old tasks empty due date and tags", () => {
  assert.deepEqual(normalize({ id: 1, title: "old", done: false }), {
    id: 1, title: "old", done: false, dueDate: null, tags: [],
  });
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
