// Whole-page tests: index.html in jsdom, a fake IndexedDB, and the real app.js on top.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { setupDom, waitFor } from "./test-dom.mjs";

setupDom({ withPage: true });
globalThis.indexedDB = new IDBFactory();
const { addTask, getTasks } = await import("./db.js");
const { todayISO } = await import("./tasks.js");
await import("./app.js");

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const titles = () => $$("#tasks .title").map((n) => n.textContent);
const count = () => $("#count").textContent;
const statusBtn = (s) => $(`#status-filter [data-status="${s}"]`);
const submit = (form) => form.dispatchEvent(new window.Event("submit", { cancelable: true }));
const tick = (box, checked) => { box.checked = checked; box.dispatchEvent(new window.Event("change")); };

async function add(title, { due = "", tags = "", repeat = "none", n } = {}) {
  $("#title").value = title;
  $("#due").value = due;
  $("#tags").value = tags;
  $("#new-repeat").value = repeat;
  $("#new-repeat").dispatchEvent(new window.Event("change"));
  if (n) $(".repeat-picker .every-n").value = n;
  submit($("#new-task"));
  await waitFor(() => titles().includes(title));
}

// Clicking "All" is the only public way to make app.js re-read the database; render has no
// completion signal, so give its IndexedDB round-trip a moment.
async function rerender() {
  statusBtn("all").click();
  await new Promise((r) => setTimeout(r, 30));
}

// Fresh empty database per test; app.js's in-memory filter state is reset through the UI.
beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  const chip = $("#tag-filter [aria-pressed=true]");
  if (chip) chip.click();
  await rerender();
  await waitFor(() => count() === "No tasks yet");
});

test("empty list says so; the Repeat picker replaces its placeholder", () => {
  assert.equal(count(), "No tasks yet");
  assert.equal($("#repeat-slot"), null);
  assert.ok($("#new-repeat"));
});

test("adding: blank title is ignored; tags are parsed and the form resets", async () => {
  $("#title").value = "   ";
  submit($("#new-task"));
  await add("Buy milk", { due: "2999-01-01", tags: " Home, home , Shop " });
  const all = await getTasks();
  assert.equal(all.length, 1);
  assert.deepEqual([all[0].title, all[0].dueDate, all[0].tags, all[0].repeat], ["Buy milk", "2999-01-01", ["home", "shop"], null]);
  assert.equal($("#title").value, "");
  assert.equal($("#new-repeat").value, "none");
  assert.equal(count(), "1 of 1 shown · 1 left");
});

test("adding a recurring task with no date gives it today's date", async () => {
  await add("Stretch", { repeat: "everyN", n: "3" });
  const [t] = await getTasks();
  assert.equal(t.dueDate, todayISO());
  assert.deepEqual(t.repeat, { freq: "everyN", n: 3 });
});

test("ticking a recurring task creates the next copy once, even after un-tick and re-tick", async () => {
  await add("Gym", { due: "2999-01-01", repeat: "daily" });
  tick($("#tasks input[type=checkbox]"), true);
  await waitFor(() => titles().length === 2);
  const tasks = await getTasks();
  assert.deepEqual(tasks.map((t) => [t.done, t.dueDate]), [[true, "2999-01-01"], [false, "2999-01-02"]]);
  assert.equal(tasks[0].spawnedNext, true);

  const doneBox = () => $$("#tasks li.done input[type=checkbox]")[0];
  tick(doneBox(), false);
  await waitFor(() => count() === "2 of 2 shown · 2 left");
  tick($$("#tasks input[type=checkbox]").find((b) => !b.checked && b.closest("li").querySelector(".due").textContent.endsWith("2999-01-01")), true);
  await waitFor(() => count() === "2 of 2 shown · 1 left");
  assert.equal((await getTasks()).length, 2);
});

test("ticking a one-off task just marks it done", async () => {
  await add("Call bank");
  tick($("#tasks input[type=checkbox]"), true);
  await waitFor(() => count() === "1 of 1 shown · 0 left");
  assert.equal((await getTasks()).length, 1);
});

test("status filter: Active/Completed narrow the list and are remembered", async () => {
  await addTask({ title: "open", createdAt: 1 });
  await addTask({ title: "finished", done: true, createdAt: 2 });
  await rerender();
  statusBtn("completed").click();
  await waitFor(() => titles().join() === "finished");
  assert.equal(localStorage.getItem("todo.status"), "completed");
  statusBtn("active").click();
  await waitFor(() => titles().join() === "open");
  $("#status-filter").click(); // the group itself, not a button: no change
  assert.equal(statusBtn("active").getAttribute("aria-pressed"), "true");
});

test("tag filter: chip narrows, second click clears; empty result has its own message", async () => {
  await addTask({ title: "a", tags: ["work"], createdAt: 1 });
  await addTask({ title: "b", tags: ["home"], done: true, createdAt: 2 });
  await rerender();
  const chip = (t) => $$("#tag-filter .chip").find((c) => c.textContent === `#${t}`);
  chip("home").click();
  await waitFor(() => titles().join() === "b");
  statusBtn("active").click();
  await waitFor(() => count() === "No tasks match these filters");
  chip("home").click();
  await waitFor(() => titles().join() === "a");
});

test("a tag filter whose last task is deleted clears itself", async () => {
  await addTask({ title: "only", tags: ["temp"] });
  await rerender();
  $("#tag-filter .chip").click();
  await waitFor(() => $("#tag-filter .chip").getAttribute("aria-pressed") === "true");
  $("#tasks button.danger").click();
  await waitFor(() => count() === "No tasks yet");
  assert.equal($$("#tag-filter .chip").length, 0);
});

test("edit: Cancel changes nothing; Save keeps the monthly day unless the date changes", async () => {
  await addTask({ title: "Rent", dueDate: "2999-01-31", repeat: { freq: "monthly", anchorDay: 31 } });
  await rerender();
  const openEditor = async () => { $("#tasks button.secondary").click(); await waitFor(() => $("#tasks form.editor")); };
  const closed = () => waitFor(() => !$("#tasks form.editor"));

  await openEditor();
  $("#tasks form.editor button.secondary").click();
  await closed();

  await openEditor();
  $$("#tasks form.editor input")[1].value = "Bills";
  submit($("#tasks form.editor"));
  await closed();
  let [t] = await getTasks();
  assert.deepEqual([t.tags, t.repeat], [["bills"], { freq: "monthly", anchorDay: 31 }]);

  await openEditor();
  $$("#tasks form.editor input")[0].value = "2999-02-15";
  submit($("#tasks form.editor"));
  await closed();
  [t] = await getTasks();
  assert.deepEqual([t.dueDate, t.repeat], ["2999-02-15", { freq: "monthly", anchorDay: 15 }]);
});
