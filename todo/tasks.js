// Pure task logic, kept free of DOM and IndexedDB so it can be unit-tested with `node --test`.
import { normalizeRepeat, nextDueDate } from "./recurrence.js";

export const STATUSES = ["all", "active", "completed"];

// Tasks saved before due dates/tags/repeat existed lack those fields; treat them as empty.
export function normalize(task) {
  return {
    ...task,
    dueDate: task.dueDate || null,
    tags: Array.isArray(task.tags) ? task.tags : [],
    repeat: normalizeRepeat(task.repeat),
  };
}

// Rules for a task's repeat on create/edit: a recurring task must have a date (today if none),
// and monthly remembers its day-of-month so the 31st survives shorter months.
export function applyRepeat({ dueDate, repeat }, today) {
  const r = normalizeRepeat(repeat);
  if (!r) return { dueDate: dueDate || null, repeat: null };
  const date = dueDate || today;
  if (r.freq === "monthly") r.anchorDay = r.anchorDay || Number(date.slice(8, 10));
  return { dueDate: date, repeat: r };
}

// The copy created when a recurring task is ticked done; null for one-off tasks, and null if this
// task already created its copy (spawnedNext) so un-tick + re-tick can't duplicate it.
export function nextOccurrence(task, today, now = Date.now()) {
  if (!task.repeat || !task.dueDate || task.spawnedNext) return null;
  return {
    title: task.title,
    done: false,
    dueDate: nextDueDate(task.dueDate, task.repeat, today),
    tags: [...task.tags],
    repeat: { ...task.repeat },
    createdAt: now,
  };
}

export function parseTags(input) {
  const tags = String(input || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(tags)];
}

// Local calendar date as YYYY-MM-DD, matching what <input type="date"> stores.
export function todayISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isOverdue(task, today = todayISO()) {
  return !task.done && !!task.dueDate && task.dueDate < today;
}

// Soonest due first; undated tasks last; ties keep creation order.
export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

export function filterTasks(tasks, { status = "all", tag = null } = {}) {
  return tasks.filter((t) => {
    if (status === "active" && t.done) return false;
    if (status === "completed" && !t.done) return false;
    if (tag && !t.tags.includes(tag)) return false;
    return true;
  });
}

export function allTags(tasks) {
  return [...new Set(tasks.flatMap((t) => t.tags))].sort();
}
