// DOM building only: turns task data into elements and reports user intent through handlers.
// No storage or app state here - app.js owns both.
import { isOverdue } from "./tasks.js";
import { FREQUENCIES, repeatLabel } from "./recurrence.js";

export const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

const labelled = (node, label) => { node.setAttribute("aria-label", label); return node; };

const FREQ_TEXT = { none: "Doesn't repeat", daily: "Daily", weekly: "Weekly", monthly: "Monthly", everyN: "Every N days" };

// Select + "N" box (shown only for every-N). Returns the element and a reader for its value.
export function repeatPicker(repeat, idPrefix = "") {
  const select = labelled(el("select", { id: idPrefix && `${idPrefix}-repeat` }), "Repeat");
  for (const f of FREQUENCIES) select.append(el("option", { value: f, textContent: FREQ_TEXT[f] }));
  select.value = repeat ? repeat.freq : "none";
  const n = labelled(el("input", { type: "number", min: 1, step: 1, value: repeat && repeat.n ? repeat.n : 2, className: "every-n" }), "Every how many days");
  const sync = () => { n.hidden = select.value !== "everyN"; };
  select.addEventListener("change", sync);
  sync();
  return {
    node: el("span", { className: "repeat-picker" }, select, n),
    read: () => ({ freq: select.value, n: n.value, anchorDay: repeat && repeat.anchorDay }),
    reset: () => { select.value = "none"; n.value = 2; sync(); },
  };
}

export function renderTask(task, { onToggle, onEdit, onDelete }) {
  const li = el("li", { className: [task.done && "done", isOverdue(task) && "overdue"].filter(Boolean).join(" ") });

  const box = labelled(el("input", { type: "checkbox", checked: task.done }), `Mark "${task.title}" done`);
  box.addEventListener("change", () => onToggle(task, box.checked));

  const meta = el("div", { className: "meta" });
  if (task.dueDate) {
    meta.append(el("span", { className: "due", textContent: `${isOverdue(task) ? "Overdue · " : "Due "}${task.dueDate}` }));
  }
  if (task.repeat) meta.append(el("span", { className: "repeat", textContent: `↻ ${repeatLabel(task.repeat)}` }));
  for (const tag of task.tags) meta.append(el("span", { className: "chip small", textContent: `#${tag}` }));

  const edit = labelled(el("button", { type: "button", className: "secondary", textContent: "Edit" }), `Edit "${task.title}"`);
  edit.addEventListener("click", () => onEdit(task));
  const del = labelled(el("button", { type: "button", className: "danger", textContent: "Delete" }), `Delete "${task.title}"`);
  del.addEventListener("click", () => onDelete(task));

  li.append(box, el("div", { className: "body" }, el("span", { className: "title", textContent: task.title }), meta), edit, del);
  return li;
}

export function renderEditor(task, { onSave, onCancel }) {
  const due = labelled(el("input", { type: "date", value: task.dueDate || "" }), "Edit due date");
  const tags = labelled(el("input", { type: "text", value: task.tags.join(", "), placeholder: "Tags, comma-separated" }), "Edit tags");
  const repeat = repeatPicker(task.repeat, "edit");

  const cancel = el("button", { type: "button", className: "secondary", textContent: "Cancel" });
  cancel.addEventListener("click", onCancel);

  const form = el("form", { className: "editor" },
    el("span", { className: "title", textContent: task.title }), due, tags, repeat.node,
    el("button", { type: "submit", textContent: "Save" }), cancel);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    onSave(task, { dueDate: due.value || null, tags: tags.value, repeat: repeat.read() });
  });
  return el("li", { className: "editing" }, form);
}
