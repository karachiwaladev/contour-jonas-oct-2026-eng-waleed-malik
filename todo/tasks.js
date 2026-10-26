// Pure task logic, kept free of DOM and IndexedDB so it can be unit-tested with `node --test`.

export const STATUSES = ["all", "active", "completed"];

// Tasks saved before due dates/tags existed have neither field; treat them as empty.
export function normalize(task) {
  return { ...task, dueDate: task.dueDate || null, tags: Array.isArray(task.tags) ? task.tags : [] };
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
