import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./test-dom.mjs";

setupDom();
const { el, repeatPicker, priorityPicker, renderTask, renderEditor } = await import("./render.js");
const { normalize } = await import("./tasks.js");

const task = (extra = {}) => normalize({ id: 1, title: "Water plants", done: false, createdAt: 1, ...extra });
const noop = { onToggle() {}, onEdit() {}, onDelete() {}, onSave() {}, onCancel() {} };
const calls = () => {
  const log = [];
  const h = {};
  for (const k of Object.keys(noop)) h[k] = (...args) => log.push([k, ...args]);
  return { h, log };
};

test("el: builds an element with props and children", () => {
  const node = el("p", { className: "x", textContent: "hi" }, el("b"));
  assert.equal(node.tagName, "P");
  assert.equal(node.className, "x");
  assert.equal(node.querySelector("b") !== null, true);
});

test("renderTask: shows title, due date, repeat badge and tags", () => {
  const li = renderTask(task({ dueDate: "2999-01-01", tags: ["home", "garden"], repeat: { freq: "weekly" } }), noop);
  assert.equal(li.querySelector(".title").textContent, "Water plants");
  assert.equal(li.querySelector(".due").textContent, "Due 2999-01-01");
  assert.equal(li.querySelector(".repeat").textContent, "↻ weekly");
  assert.deepEqual([...li.querySelectorAll(".chip")].map((c) => c.textContent), ["#home", "#garden"]);
  assert.equal(li.className, "");
});

test("renderTask: overdue and done states get their classes; no badge or date when absent", () => {
  const overdue = renderTask(task({ dueDate: "2000-01-01" }), noop);
  assert.equal(overdue.className, "overdue");
  assert.match(overdue.querySelector(".due").textContent, /^Overdue · 2000-01-01$/);
  const done = renderTask(task({ done: true }), noop);
  assert.equal(done.className, "done");
  assert.equal(done.querySelector(".due"), null);
  assert.equal(done.querySelector(".repeat"), null);
});

test("renderTask: user text is never parsed as HTML (XSS)", () => {
  const evil = '<img src=x onerror="alert(1)">';
  const li = renderTask(task({ title: evil, tags: [evil] }), noop);
  assert.equal(li.querySelector("img"), null);
  assert.equal(li.querySelector(".title").textContent, evil);
  assert.equal(li.querySelector("input").getAttribute("aria-label"), `Mark "${evil}" done`);
});

test("renderTask: checkbox, Edit and Delete report to the handlers", () => {
  const t = task();
  const { h, log } = calls();
  const li = renderTask(t, h);
  const box = li.querySelector("input[type=checkbox]");
  box.checked = true;
  box.dispatchEvent(new window.Event("change"));
  li.querySelector("button.secondary").click();
  li.querySelector("button.danger").click();
  assert.deepEqual(log, [["onToggle", t, true], ["onEdit", t], ["onDelete", t]]);
});

test("repeatPicker: N box only shows for every-N; read and reset", () => {
  const p = repeatPicker(null, "new");
  const select = p.node.querySelector("select");
  const n = p.node.querySelector(".every-n");
  assert.equal(select.id, "new-repeat");
  assert.equal(select.value, "none");
  assert.equal(n.hidden, true);
  select.value = "everyN";
  select.dispatchEvent(new window.Event("change"));
  assert.equal(n.hidden, false);
  n.value = "4";
  assert.deepEqual(p.read(), { freq: "everyN", n: "4", anchorDay: null });
  p.reset();
  assert.equal(select.value, "none");
  assert.equal(n.hidden, true);
});

test("repeatPicker: starts from an existing repeat and keeps its anchor day", () => {
  const p = repeatPicker({ freq: "monthly", anchorDay: 31 });
  assert.equal(p.node.querySelector("select").id, "");
  assert.equal(p.node.querySelector("select").value, "monthly");
  assert.deepEqual(p.read(), { freq: "monthly", n: "2", anchorDay: 31 });
  const every3 = repeatPicker({ freq: "everyN", n: 3 });
  assert.equal(every3.node.querySelector(".every-n").value, "3");
});

test("renderEditor: prefilled fields; Save sends edited values, Cancel reports cancel", () => {
  const t = task({ dueDate: "2026-10-26", tags: ["a", "b"], repeat: { freq: "daily" } });
  const { h, log } = calls();
  const li = renderEditor(t, h);
  const [date, tags] = li.querySelectorAll("input");
  assert.equal(date.value, "2026-10-26");
  assert.equal(tags.value, "a, b");
  date.value = "";
  tags.value = "x";
  li.querySelector("form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  li.querySelector("button.secondary").click();
  assert.deepEqual(log[0], ["onSave", t, { dueDate: null, tags: "x", repeat: { freq: "daily", n: "2", anchorDay: undefined }, priority: null }]);
  assert.equal(log[1][0], "onCancel");
});

test("renderEditor: a task with no date or tags opens with empty fields", () => {
  const li = renderEditor(task(), noop);
  const [date, tags] = li.querySelectorAll("input");
  assert.equal(date.value, "");
  assert.equal(tags.value, "");
});

test("priorityPicker: No priority + High/Medium/Low, starts at the given value", () => {
  const s = priorityPicker(null);
  assert.equal(s.getAttribute("aria-label"), "Priority");
  assert.deepEqual([...s.options].map((o) => [o.value, o.textContent]), [["", "No priority"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]);
  assert.equal(s.value, "");
  assert.equal(priorityPicker("medium").value, "medium");
});

test("renderTask: priority badge with its level as class; none when no priority", () => {
  const li = renderTask(task({ priority: "high" }), noop);
  const b = li.querySelector(".priority");
  assert.equal(b.textContent, "High");
  assert.equal(b.className, "priority high");
  assert.equal(renderTask(task(), noop).querySelector(".priority"), null);
});

test("renderEditor: priority starts at the task's value and is sent on Save (empty = null)", () => {
  const { h, log } = calls();
  const li = renderEditor(task({ priority: "low" }), h);
  const sel = li.querySelector('select[aria-label="Priority"]');
  assert.equal(sel.value, "low");
  sel.value = "";
  li.querySelector("form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  assert.equal(log[0][2].priority, null);
});
