// App state and event wiring. Rendering lives in render.js, rules in tasks.js/recurrence.js.
import { getTasks, addTask, updateTask, deleteTask } from "./db.js";
import { STATUSES, normalize, normalizePriority, parseTags, todayISO, sortTasks, filterTasks, allTags, applyRepeat, nextOccurrence } from "./tasks.js";
import { el, repeatPicker, priorityPicker, renderTask, renderEditor } from "./render.js";

const form = document.getElementById("new-task");
const titleInput = document.getElementById("title");
const dueInput = document.getElementById("due");
const tagsInput = document.getElementById("tags");
const searchInput = document.getElementById("search");
const statusFilter = document.getElementById("status-filter");
const priorityFilter = document.getElementById("priority-filter");
const tagFilter = document.getElementById("tag-filter");
const list = document.getElementById("tasks");
const count = document.getElementById("count");

const newRepeat = repeatPicker(null, "new");
document.getElementById("repeat-slot").replaceWith(newRepeat.node);
const newPriority = priorityPicker(null);
document.getElementById("priority-slot").replaceWith(newPriority);

// Storage can throw in private windows; the filter just falls back to "all".
const STATUS_KEY = "todo.status";
const loadStatus = () => {
  try { const s = localStorage.getItem(STATUS_KEY); return STATUSES.includes(s) ? s : "all"; } catch { return "all"; }
};
const saveStatus = (s) => { try { localStorage.setItem(STATUS_KEY, s); } catch {} };

// search isn't saved: a reload starts with an empty box (approved plan, issue #11).
const state = { status: loadStatus(), tag: null, priority: "all", search: "", editingId: null };

const handlers = {
  async onToggle(task, done) {
    // Only the not-done -> done transition spawns the next copy; un-ticking leaves it alone.
    const next = done && !task.done ? nextOccurrence(task, todayISO()) : null;
    await updateTask({ ...task, done, ...(next && { spawnedNext: true }) });
    if (next) await addTask(next);
    render();
  },
  onEdit(task) { state.editingId = task.id; render(); },
  async onDelete(task) { await deleteTask(task.id); render(); },
  async onSave(task, { dueDate, tags, repeat, priority }) {
    // A new due date re-anchors monthly repeats to its day; otherwise keep the original anchor.
    const r = dueDate === task.dueDate ? repeat : { ...repeat, anchorDay: undefined };
    await updateTask({ ...task, ...applyRepeat({ dueDate, repeat: r }, todayISO()), tags: parseTags(tags), priority: normalizePriority(priority) });
    state.editingId = null;
    render();
  },
  onCancel() { state.editingId = null; render(); },
};

async function render() {
  const tasks = (await getTasks()).map(normalize);
  const tags = allTags(tasks);
  if (state.tag && !tags.includes(state.tag)) state.tag = null;

  for (const btn of statusFilter.querySelectorAll("button")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.status === state.status));
  }
  for (const btn of priorityFilter.querySelectorAll("button")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.priority === state.priority));
  }
  tagFilter.replaceChildren(...tags.map((tag) => {
    const chip = el("button", { type: "button", className: "chip", textContent: `#${tag}` });
    chip.setAttribute("aria-pressed", String(tag === state.tag));
    chip.addEventListener("click", () => { state.tag = state.tag === tag ? null : tag; render(); });
    return chip;
  }));

  const shown = sortTasks(filterTasks(tasks, state));
  list.replaceChildren(...shown.map((t) => (t.id === state.editingId ? renderEditor(t, handlers) : renderTask(t, handlers))));
  if (!tasks.length) count.textContent = "No tasks yet";
  else if (!shown.length) count.textContent = "No tasks match these filters";
  else count.textContent = `${shown.length} of ${tasks.length} shown · ${tasks.filter((t) => !t.done).length} left`;
}

const setSearch = (value) => { state.search = value; render(); };
const clearSearch = () => { searchInput.value = ""; setSearch(""); };
searchInput.addEventListener("input", () => setSearch(searchInput.value));
searchInput.addEventListener("keydown", (e) => { if (e.key === "Escape") clearSearch(); });
document.getElementById("search-clear").addEventListener("click", () => { clearSearch(); searchInput.focus(); });

statusFilter.addEventListener("click", (e) => {
  const status = e.target.dataset && e.target.dataset.status;
  if (!status) return;
  state.status = status;
  saveStatus(status);
  render();
});

priorityFilter.addEventListener("click", (e) => {
  const priority = e.target.dataset && e.target.dataset.priority;
  if (!priority) return;
  state.priority = priority;
  render();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;
  const { dueDate, repeat } = applyRepeat({ dueDate: dueInput.value || null, repeat: newRepeat.read() }, todayISO());
  await addTask({ title, dueDate, tags: parseTags(tagsInput.value), repeat, priority: normalizePriority(newPriority.value) });
  form.reset();
  newRepeat.reset();
  render();
});

render();
