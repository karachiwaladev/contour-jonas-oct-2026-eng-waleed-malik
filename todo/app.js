import { getTasks, addTask, updateTask, deleteTask } from "./db.js";
import { STATUSES, normalize, parseTags, isOverdue, sortTasks, filterTasks, allTags } from "./tasks.js";

const form = document.getElementById("new-task");
const titleInput = document.getElementById("title");
const dueInput = document.getElementById("due");
const tagsInput = document.getElementById("tags");
const statusFilter = document.getElementById("status-filter");
const tagFilter = document.getElementById("tag-filter");
const list = document.getElementById("tasks");
const count = document.getElementById("count");

// Storage can throw in private windows; the filter just falls back to "all".
const STATUS_KEY = "todo.status";
const loadStatus = () => {
  try { const s = localStorage.getItem(STATUS_KEY); return STATUSES.includes(s) ? s : "all"; } catch { return "all"; }
};
const saveStatus = (s) => { try { localStorage.setItem(STATUS_KEY, s); } catch {} };

const state = { status: loadStatus(), tag: null, editingId: null };

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

async function render() {
  const tasks = (await getTasks()).map(normalize);
  const tags = allTags(tasks);
  if (state.tag && !tags.includes(state.tag)) state.tag = null;

  for (const btn of statusFilter.querySelectorAll("button")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.status === state.status));
  }
  tagFilter.replaceChildren(...tags.map((tag) => {
    const chip = el("button", { type: "button", className: "chip", textContent: `#${tag}` });
    chip.setAttribute("aria-pressed", String(tag === state.tag));
    chip.addEventListener("click", () => { state.tag = state.tag === tag ? null : tag; render(); });
    return chip;
  }));

  const shown = sortTasks(filterTasks(tasks, state));
  list.replaceChildren(...shown.map((t) => (t.id === state.editingId ? renderEditor(t) : renderTask(t))));
  if (!tasks.length) count.textContent = "No tasks yet";
  else if (!shown.length) count.textContent = "No tasks match these filters";
  else count.textContent = `${shown.length} of ${tasks.length} shown · ${tasks.filter((t) => !t.done).length} left`;
}

function renderTask(task) {
  const li = el("li", { className: [task.done && "done", isOverdue(task) && "overdue"].filter(Boolean).join(" ") });

  const box = el("input", { type: "checkbox", checked: task.done });
  box.setAttribute("aria-label", `Mark "${task.title}" done`);
  box.addEventListener("change", async () => { await updateTask({ ...task, done: box.checked }); render(); });

  const meta = el("div", { className: "meta" });
  if (task.dueDate) {
    meta.append(el("span", { className: "due", textContent: `${isOverdue(task) ? "Overdue · " : "Due "}${task.dueDate}` }));
  }
  for (const tag of task.tags) meta.append(el("span", { className: "chip small", textContent: `#${tag}` }));

  const body = el("div", { className: "body" }, el("span", { className: "title", textContent: task.title }), meta);

  const edit = el("button", { type: "button", className: "secondary", textContent: "Edit" });
  edit.setAttribute("aria-label", `Edit "${task.title}"`);
  edit.addEventListener("click", () => { state.editingId = task.id; render(); });

  const del = el("button", { type: "button", className: "danger", textContent: "Delete" });
  del.setAttribute("aria-label", `Delete "${task.title}"`);
  del.addEventListener("click", async () => { await deleteTask(task.id); render(); });

  li.append(box, body, edit, del);
  return li;
}

function renderEditor(task) {
  const due = el("input", { type: "date", value: task.dueDate || "" });
  due.setAttribute("aria-label", "Edit due date");
  const tags = el("input", { type: "text", value: task.tags.join(", "), placeholder: "Tags, comma-separated" });
  tags.setAttribute("aria-label", "Edit tags");

  const save = el("button", { type: "submit", textContent: "Save" });
  const cancel = el("button", { type: "button", className: "secondary", textContent: "Cancel" });
  cancel.addEventListener("click", () => { state.editingId = null; render(); });

  const editor = el("form", { className: "editor" }, el("span", { className: "title", textContent: task.title }), due, tags, save, cancel);
  editor.addEventListener("submit", async (e) => {
    e.preventDefault();
    await updateTask({ ...task, dueDate: due.value || null, tags: parseTags(tags.value) });
    state.editingId = null;
    render();
  });
  return el("li", { className: "editing" }, editor);
}

statusFilter.addEventListener("click", (e) => {
  const status = e.target.dataset && e.target.dataset.status;
  if (!status) return;
  state.status = status;
  saveStatus(status);
  render();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;
  await addTask(title, dueInput.value || null, parseTags(tagsInput.value));
  form.reset();
  render();
});

render();
