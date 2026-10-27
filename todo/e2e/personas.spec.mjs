// Fast lane of the persona sweep: each persona's core goal as a QuickE2E flow (D:\projects\quicke2e).
// Jev picks every click from the page's legal moves; the assertions below decide pass/fail, not a model.
// Personas: todo/personas.yaml. Judgement calls (confusing words, focus, contrast) stay in the
// Claude sub-agent lane of .claude/skills/persona-sweep/SKILL.md.
export default [
  {
    name: "light-lou-add-one",
    goal: "Add a task called Buy milk.",
    inputs: { "new task": "Buy milk" },
    expect: ["Buy milk", "1 left"],
  },
  {
    name: "careful-cara-tag-and-priority",
    goal: "Add a task called Send report with the tag work and High priority, then click Add.",
    inputs: { "new task": "Send report", tags: "work", priority: "High" },
    expect: ["Send report", "High", "#work"],
  },
  {
    name: "newbie-nell-weekly",
    goal: "Add a task called Call grandma that repeats weekly, then click Add.",
    inputs: { "new task": "Call grandma", repeat: "Weekly" },
    expect: ["Call grandma", "weekly"],
  },
  {
    name: "power-pia-due-date",
    goal: "Add a task called File taxes due on 2026-11-20, then click Add.",
    inputs: { "new task": "File taxes", "due date": "2026-11-20" },
    expect: ["File taxes", "Due 2026-11-20"],
  },
  {
    name: "savvy-tara-search-no-match",
    goal: "Add a task called Pay rent, then search the tasks for zzz.",
    inputs: { "new task": "Pay rent", "search tasks": "zzz" },
    expect: ["No tasks match these filters"],
  },
  {
    name: "hal-delete-is-visible",
    goal: "Add a task called Temp task, then delete it.",
    inputs: { "new task": "Temp task" },
    expectSeen: ["Temp task"],
    expectGone: ["Temp task"],
  },
  // Malicious Mal: the title must come back as literal text. If the app rendered it as HTML, the
  // visible text would lose the tags (or the onerror would fire a dialog, recorded in `dialogs`).
  {
    name: "mal-html-title-is-text",
    kind: "attack",
    goal: "Add a task called <b>bold</b> <img src=x onerror=alert(1)>, then click Add.",
    inputs: { "new task": "<b>bold</b> <img src=x onerror=alert(1)>" },
    expect: ["<b>bold</b> <img src=x onerror=alert(1)>"],
  },
  {
    name: "mal-html-tag-is-text",
    kind: "attack",
    goal: "Add a task called Payload with the tag <svg onload=alert(1)>, then click Add.",
    inputs: { "new task": "Payload", tags: "<svg onload=alert(1)>" },
    expect: ["#<svg onload=alert(1)>"],
  },
];
