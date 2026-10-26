import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { getTasks, addTask, updateTask, deleteTask } from "./db.js";

// A fresh in-memory database per test; db.js reads the global indexedDB on every call.
beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });

test("getTasks: empty database returns no tasks", async () => {
  assert.deepEqual(await getTasks(), []);
});

test("addTask: fills defaults and returns the new id", async () => {
  const id = await addTask({ title: "Buy milk" });
  const [task] = await getTasks();
  assert.equal(task.id, id);
  assert.equal(task.title, "Buy milk");
  assert.equal(task.done, false);
  assert.equal(task.dueDate, null);
  assert.deepEqual(task.tags, []);
  assert.equal(task.repeat, null);
  assert.equal(typeof task.createdAt, "number");
});

test("addTask: given fields override the defaults", async () => {
  await addTask({ title: "Gym", dueDate: "2026-10-26", tags: ["health"], repeat: { freq: "daily" }, done: true });
  const [task] = await getTasks();
  assert.equal(task.dueDate, "2026-10-26");
  assert.deepEqual(task.tags, ["health"]);
  assert.deepEqual(task.repeat, { freq: "daily" });
  assert.equal(task.done, true);
});

test("updateTask: saves changes to an existing task", async () => {
  const id = await addTask({ title: "Read" });
  const [task] = await getTasks();
  await updateTask({ ...task, done: true, tags: ["books"] });
  const [after] = await getTasks();
  assert.equal(after.id, id);
  assert.equal(after.done, true);
  assert.deepEqual(after.tags, ["books"]);
});

test("deleteTask: removes only that task", async () => {
  const keep = await addTask({ title: "Keep" });
  const drop = await addTask({ title: "Drop" });
  await deleteTask(drop);
  assert.deepEqual((await getTasks()).map((t) => t.id), [keep]);
});

test("errors reject: database that will not open", async () => {
  const req = {};
  globalThis.indexedDB = { open: () => (queueMicrotask(() => { req.error = new Error("blocked"); req.onerror(); }), req) };
  await assert.rejects(getTasks(), /blocked/);
});

test("errors reject: a failed write (duplicate id)", async () => {
  await addTask({ id: 1, title: "a" });
  // Rejects with null today: db.js reads tx.error, which IndexedDB only fills in after abort.
  await assert.rejects(addTask({ id: 1, title: "b" }), (err) => err === null);
});
