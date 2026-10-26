# Software Factory

This repo is a **software factory**: work arrives as GitHub Issues (`Ticket #N: ...`), an agent loop
picks each one up, does the work, pushes to `main`, comments the result and closes the issue.
We build and improve the loop, not individual features by hand.

Only what is on GitHub counts: files, commits, issue comments, closed issues.

## Progressive disclosure

This file is the **index**, not the manual. It stays short and tells the agent where to look;
the detail lives next to the work and is loaded only when a ticket needs it.

1. **Level 1 - this file**: what the factory is, the rules, and the index below. Always loaded.
2. **Level 2 - a project's own `README.md` / `CLAUDE.md`**: read only when a ticket touches that project.
3. **Level 3 - skills and reference files** (`.claude/skills/*/SKILL.md`, a project's `docs/`):
   read only when that specific step is being done.

Don't copy project detail up into this file - link to it from the index instead.

## Layout

```
CLAUDE.md                     # this index (keep under 100 lines)
.claude/skills/factory-loop/  # the ticket loop
<project-slug>/               # one top-level folder per project, each with its own README.md
answers/                      # answers to question tickets, one file per ticket
```

## Index

### Projects

Each project lives in its own top-level folder. Add a row here whenever one is created.

| Project | Folder | What it is | Ticket |
|---|---|---|---|
| Todo app | [`todo/`](todo/README.md) | Browser todo list: due dates, tags, status/tag filters; IndexedDB storage | #3, #4 |

### Skills

| Skill | Path | Use it for |
|---|---|---|
| factory-loop | `.claude/skills/factory-loop/SKILL.md` | Picking up, doing, commenting on and closing tickets |
| quality-gate | `.claude/skills/quality-gate/SKILL.md` | Tests first, architecture, security and review before any PR |

Plugins the loop relies on (declared in `.claude/settings.json`): `superpowers` (TDD, plans,
verification), `code-review`, `skill-creator`; plus built-in `security-review` and `simplify`.

**Stop hook** (`.claude/hooks/auto-commit.js`): after every reply, appends new prompts to
`.claude/logs/prompts.jsonl`, then commits and pushes any changes (skips if a secret is detected).

## Rules

- **Keep this file under 100 lines at all times.** If an edit would push it over, move detail
  down into the project's folder and leave a one-line pointer here.
- **New project = new top-level folder** `<project-slug>/` (use the name the ticket gives) with a
  `README.md`, plus a row in the index.
  Never mix two projects in one folder.
- **Every ticket goes through a PR**: work on a `ticket-<N>-*` branch, commit as `Ticket #N: ...`, open
  a PR, and merge + close only after the author approves. Answers to question tickets live in `answers/`.
- **Unclear ticket**: ask on the GitHub issue, not in chat, then move on to the next ticket.
- Training repo only: no Jonas or Contour code, no real keys or secrets.
