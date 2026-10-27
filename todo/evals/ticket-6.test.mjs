// Task eval for Ticket #6 (Task priority). One test per check in the approved plan's Eval list
// (issue #8). Drives the real page (index.html + app.js) in jsdom over a fake IndexedDB.
// Written before any feature code; changing a check needs the author's approval on the PR.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { setupDom, waitFor } from "../test-dom.mjs";

setupDom({ withPage: true });
globalThis.indexedDB = new IDBFactory();
const { addTask, getTasks } = await import("../db.js");
await import("../app.js");

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const titles = () => $$("#tasks .title").map((n) => n.textContent);
const row = (title) => $$("#tasks li").find((li) => li.querySelector(".title").textContent === title);
const badge = (title) => { const b = row(title).querySelector(".priority"); return b ? b.textContent : null; };
const formPriority = () => $('#new-task select[aria-label="Priority"]');
const priorityBtn = (p) => $(`#priority-filter [data-priority="${p}"]`);
const statusBtn = (s) => $(`#status-filter [data-status="${s}"]`);
const change = (node, value) => { node.value = value; node.dispatchEvent(new window.Event("change")); };
const submit = (form) => form.dispatchEvent(new window.Event("submit", { cancelable: true }));
const settle = () => new Promise((r) => setTimeout(r, 30));
const byTitle = async (t) => (await getTasks()).find((x) => x.title === t);

async function add(title, { priority, due = "", tags = "", repeat = "none" } = {}) {
  $("#title").value = title;
  $("#due").value = due;
  $("#tags").value = tags;
  change($("#new-repeat"), repeat);
  if (priority) change(formPriority(), priority);
  submit($("#new-task"));
  await waitFor(() => titles().includes(title));
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  const chip = $("#tag-filter [aria-pressed=true]");
  if (chip) chip.click();
  if (priorityBtn("all")) priorityBtn("all").click();
  statusBtn("all").click();
  await settle();
  await waitFor(() => $("#count").textContent === "No tasks yet");
});

test("E1: add form has a Priority dropdown starting at No priority, reset after adding", async () => {
  const select = formPriority();
  assert.ok(select, "no Priority dropdown in the add form");
  assert.deepEqual([...select.options].map((o) => [o.value, o.textContent]),
    [["", "No priority"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]);
  assert.equal(select.value, "");
  await add("Pay rent", { priority: "high" });
  assert.equal(formPriority().value, "");
});

test("E2: High/Medium/Low are saved and shown as badges", async () => {
  await add("A", { priority: "high" });
  await add("B", { priority: "medium" });
  await add("C", { priority: "low" });
  assert.deepEqual([(await byTitle("A")).priority, (await byTitle("B")).priority, (await byTitle("C")).priority], ["high", "medium", "low"]);
  assert.deepEqual([badge("A"), badge("B"), badge("C")], ["High", "Medium", "Low"]);
  assert.ok(row("A").querySelector(".priority").classList.contains("high"));
});

test("E3: no priority, missing field or unknown value loads fine with no badge", async () => {
  await add("Plain");
  await addTask({ title: "Old task" });
  await addTask({ title: "Weird", priority: "urgent" });
  // Contrast case, so "no badge" can't pass just because badges don't exist at all.
  await addTask({ title: "Real", priority: "high" });
  statusBtn("all").click();
  await waitFor(() => titles().length === 4);
  assert.equal((await byTitle("Plain")).priority ?? null, null);
  assert.deepEqual([badge("Plain"), badge("Old task"), badge("Weird"), badge("Real")], [null, null, null, "High"]);
});

test("E4: High filter shows only High tasks and shows as pressed; All shows everything", async () => {
  await add("H", { priority: "high" });
  await add("L", { priority: "low" });
  await add("N");
  assert.ok(priorityBtn("high"), "no priority filter");
  priorityBtn("high").click();
  await waitFor(() => titles().join() === "H");
  assert.equal(priorityBtn("high").getAttribute("aria-pressed"), "true");
  assert.equal(priorityBtn("all").getAttribute("aria-pressed"), "false");
  priorityBtn("all").click();
  await waitFor(() => titles().length === 3);
});

test("E5: priority filter combines with status and tag filters", async () => {
  await addTask({ title: "match", priority: "high", tags: ["work"], createdAt: 1 });
  await addTask({ title: "done-high-work", priority: "high", tags: ["work"], done: true, createdAt: 2 });
  await addTask({ title: "high-home", priority: "high", tags: ["home"], createdAt: 3 });
  await addTask({ title: "low-work", priority: "low", tags: ["work"], createdAt: 4 });
  statusBtn("all").click();
  await waitFor(() => titles().length === 4);
  assert.ok(priorityBtn("high"), "no priority filter");
  statusBtn("active").click();
  $$("#tag-filter .chip").find((c) => c.textContent === "#work").click();
  await settle();
  priorityBtn("high").click();
  await waitFor(() => titles().join() === "match");
});

test("E6: Edit shows the current priority; Save changes it; Cancel doesn't", async () => {
  await add("Task", { priority: "medium" });
  const open = async () => { row("Task").querySelector("button.secondary").click(); await waitFor(() => $("#tasks form.editor")); };
  const editorPriority = () => $('#tasks form.editor select[aria-label="Priority"]');
  await open();
  assert.ok(editorPriority(), "no Priority dropdown in the editor");
  assert.equal(editorPriority().value, "medium");
  editorPriority().value = "low";
  $("#tasks form.editor button.secondary").click();
  await waitFor(() => !$("#tasks form.editor"));
  assert.equal((await byTitle("Task")).priority, "medium");
  await open();
  editorPriority().value = "high";
  submit($("#tasks form.editor"));
  await waitFor(() => !$("#tasks form.editor"));
  assert.equal((await byTitle("Task")).priority, "high");
  assert.equal(badge("Task"), "High");
});

test("E7: ticking a recurring High task creates a next copy that is also High", async () => {
  await add("Gym", { priority: "high", due: "2999-01-01", repeat: "daily" });
  const box = row("Gym").querySelector("input[type=checkbox]");
  box.checked = true;
  box.dispatchEvent(new window.Event("change"));
  await waitFor(() => titles().length === 2);
  const copies = (await getTasks()).filter((t) => !t.done);
  assert.equal(copies.length, 1);
  assert.equal(copies[0].priority, "high");
});

test("E8: same due date sorts High, Medium, Low, none; different dates still sort by date", async () => {
  await addTask({ title: "none", dueDate: "2999-05-01", createdAt: 1 });
  await addTask({ title: "low", dueDate: "2999-05-01", priority: "low", createdAt: 2 });
  await addTask({ title: "high", dueDate: "2999-05-01", priority: "high", createdAt: 3 });
  await addTask({ title: "medium", dueDate: "2999-05-01", priority: "medium", createdAt: 4 });
  await addTask({ title: "earlier-low", dueDate: "2999-04-01", priority: "low", createdAt: 5 });
  statusBtn("all").click();
  await waitFor(() => titles().length === 5);
  assert.deepEqual(titles(), ["earlier-low", "high", "medium", "low", "none"]);
});
