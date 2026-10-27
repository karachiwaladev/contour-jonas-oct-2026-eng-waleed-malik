// Task eval for Ticket #10 (Search). One test per check in the approved plan's Eval list
// (issue #11). Drives the real page (index.html + app.js) in jsdom over a fake IndexedDB.
// Written before any feature code; changing a check needs the author's approval on the PR.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { setupDom, waitFor } from "../test-dom.mjs";

setupDom({ withPage: true });
globalThis.indexedDB = new IDBFactory();
await import("../app.js");

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const titles = () => $$("#tasks .title").map((n) => n.textContent);
const search = () => $("#search");
const statusBtn = (s) => $(`#status-filter [data-status="${s}"]`);
const priorityBtn = (p) => $(`#priority-filter [data-priority="${p}"]`);
const change = (node, value) => { node.value = value; node.dispatchEvent(new window.Event("change")); };
const submit = (form) => form.dispatchEvent(new window.Event("submit", { cancelable: true }));
const settle = () => new Promise((r) => setTimeout(r, 30));
const sameSet = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

async function type(text) {
  const box = search();
  assert.ok(box, "no search box (#search)");
  box.value = text;
  box.dispatchEvent(new window.Event("input"));
  await settle();
}

async function add(title, { tags = "", priority } = {}) {
  $("#title").value = title;
  $("#due").value = "";
  $("#tags").value = tags;
  if (priority) change($('#new-task select[aria-label="Priority"]'), priority);
  submit($("#new-task"));
  await waitFor(() => titles().includes(title));
}

async function seed() {
  await add("Buy MILK", { tags: "home" });
  await add("Workout", { tags: "health" });
  await add("Email boss", { tags: "work", priority: "high" });
  await add("Milk the cows", { tags: "farm, work", priority: "high" });
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  if (search()) await type("");
  const chip = $("#tag-filter [aria-pressed=true]");
  if (chip) chip.click();
  priorityBtn("all").click();
  statusBtn("all").click();
  await settle();
  await waitFor(() => $("#count").textContent === "No tasks yet");
  await seed();
});

test("E1: typing a title fragment shows only matching titles, ignoring case", async () => {
  await type("milk");
  sameSet(titles(), ["Buy MILK", "Milk the cows"]);
});

test("E2: part of a tag matches tags; a leading # searches tags only", async () => {
  await type("wor");
  sameSet(titles(), ["Workout", "Email boss", "Milk the cows"]);
  await type("#wor");
  sameSet(titles(), ["Email boss", "Milk the cows"]);
});

test("E3: the list updates on each keystroke, no Enter needed", async () => {
  await type("m");
  sameSet(titles(), ["Buy MILK", "Email boss", "Milk the cows"]);
  await type("mi");
  sameSet(titles(), ["Buy MILK", "Milk the cows"]);
  await type("mil");
  sameSet(titles(), ["Buy MILK", "Milk the cows"]);
});

test("E4: search combines with status, tag and priority filters", async () => {
  const cows = $$("#tasks li").find((li) => li.querySelector(".title").textContent === "Milk the cows");
  cows.querySelector('input[type="checkbox"]').click();
  await settle();
  statusBtn("active").click();
  priorityBtn("high").click();
  await type("milk");
  assert.deepEqual(titles(), []);
  statusBtn("all").click();
  await settle();
  assert.deepEqual(titles(), ["Milk the cows"]);
  $$("#tag-filter button").find((b) => b.textContent === "#farm").click();
  await settle();
  assert.deepEqual(titles(), ["Milk the cows"]);
});

test("E5: the clear button and Esc clear the box and show everything again", async () => {
  await type("milk");
  $("#search-clear").click();
  await settle();
  assert.equal(search().value, "");
  assert.equal(titles().length, 4);
  await type("milk");
  search().dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
  await settle();
  assert.equal(search().value, "");
  assert.equal(titles().length, 4);
});

test("E6: spaces only, or an empty box, means no search", async () => {
  await type("   ");
  assert.equal(titles().length, 4);
  await type("");
  assert.equal(titles().length, 4);
});

test("E7: no match shows 'No tasks match these filters'", async () => {
  await type("zzz");
  assert.deepEqual(titles(), []);
  assert.equal($("#count").textContent, "No tasks match these filters");
});

test("E8: after a reload the box is empty and every task shows", async () => {
  await type("milk");
  // Reload: a fresh page and a fresh copy of app.js over the same stored tasks.
  setupDom({ withPage: true });
  await import(`../app.js?reload=${Date.now()}`);
  await waitFor(() => titles().length === 4);
  assert.equal(search().value, "");
});
