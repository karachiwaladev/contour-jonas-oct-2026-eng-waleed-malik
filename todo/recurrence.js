// Recurrence date maths on YYYY-MM-DD strings. Pure: no DOM, no storage.
// Works in UTC so daylight-saving changes can never shift a date by a day.

export const FREQUENCIES = ["none", "daily", "weekly", "monthly", "everyN"];

const DAY_MS = 86400000;
const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d }; };
const fmt = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

const addDays = (iso, days) => {
  const { y, m, d } = parse(iso);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};

// Anything that isn't a valid repeat setting means "not recurring".
export function normalizeRepeat(repeat) {
  if (!repeat || !FREQUENCIES.includes(repeat.freq) || repeat.freq === "none") return null;
  if (repeat.freq === "everyN") {
    const n = Math.floor(Number(repeat.n));
    return { freq: "everyN", n: Number.isFinite(n) && n >= 1 ? n : 1 };
  }
  if (repeat.freq === "monthly" && repeat.anchorDay) return { freq: "monthly", anchorDay: repeat.anchorDay };
  return { freq: repeat.freq };
}

export function stepDate(iso, repeat) {
  switch (repeat.freq) {
    case "daily": return addDays(iso, 1);
    case "weekly": return addDays(iso, 7);
    case "everyN": return addDays(iso, repeat.n);
    case "monthly": {
      // anchorDay keeps "the 31st" as the 31st after passing through a shorter month.
      const { y, m, d } = parse(iso);
      const anchor = repeat.anchorDay || d;
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      return fmt(ny, nm, Math.min(anchor, daysInMonth(ny, nm)));
    }
    default: throw new Error(`Unknown repeat: ${repeat.freq}`);
  }
}

// Always moves forward at least once; if that's still in the past, keep going until today or later,
// so finishing late never leaves a pile of overdue copies.
export function nextDueDate(dueISO, repeat, todayISO) {
  let next = stepDate(dueISO, repeat);
  while (next < todayISO) next = stepDate(next, repeat);
  return next;
}

export function repeatLabel(repeat) {
  if (!repeat) return "";
  if (repeat.freq === "everyN") return repeat.n === 1 ? "every day" : `every ${repeat.n} days`;
  return repeat.freq;
}
