---
name: persona-sweep
description: Run simulated users (personas - fast and careless, careful, newbie, tech-savvy, power user, light and occasional users, hearing-impaired, blind screen-reader user, low-vision, distracted, malicious) against the todo app in real Chrome tabs, one Claude sub-agent per persona, and report where they got stuck, ranked by how many hit each problem. Use when the user asks for a persona sweep, usability or accessibility testing, "how would different users find this", an adversarial/abuse test of the UI, or before a UI-heavy PR when the user asks for it.
---

# Persona sweep

The persona panel is [`todo/personas.yaml`](../../../todo/personas.yaml): 12 personas in
shoal's schema (`D:\projects\shoal`) (`id`, `name`, `patience_steps`, `profile`, optional `modality: a11y`).
Each persona runs as **one Claude sub-agent driving its own tab** in the user's open Chrome
(`claude-in-chrome`). No API key and no third-party tool holding the user's Claude token.
On demand only: it costs a sub-agent per persona.

## Each sweep

1. **Serve the branch under test, one port per persona.** IndexedDB is per origin, so personas sharing
   a port would see (and the malicious one would wreck) each other's tasks. Check out the branch in a
   worktree under the scratchpad, then serve its `todo/` on ports 5181-5192 with a small Node static
   server (one `http.createServer` per port, bound to 127.0.0.1). Check with `node -e "fetch(...)"`
   (`curl` is denied by settings).
2. **Spawn the personas as sub-agents, 6 at a time** (12 at once fight over one Chrome window), each with
   `effort: "lower"` and a brief containing: its port, its persona `profile` verbatim, the task, and these
   rules - load the Chrome tools in one ToolSearch call; create its own tab and touch no other; act through
   real clicks/keys (refs from `find`/`read_page`), `javascript_tool` only to *read* state; reload with
   `navigate`; stay on its URL; ~30-45 actions; close its tab; report `outcome` + findings as
   `[severity] what — steps — expected vs actual`, marking "suspected" and tooling limits.
   - `modality: a11y` (Blind Bea): no screenshots; perceive only via `read_page`/`find` and
     `document.activeElement`; operate only by keyboard.
   - Malicious Mal: payloads use `console.log`, never `alert`; delivered through the app's own inputs;
     checks `read_console_messages` and the DOM for anything that executed or rendered as HTML.
   - Default task: "Add a few tasks with tags, priorities and a due date; find one with search; mark one
     done; delete one; reload and check nothing was lost." Tailor per persona (keyboard-only, many tasks...).
3. **Merge the reports** into one friction table: each distinct issue, how many personas hit it, which
   ones, severity. Reproduce every high/med finding by hand before calling it confirmed; a single
   agent's claim stays "suspected". Write it to `D:\projects\_qa-reports\persona-sweep-<YYYY-MM-DD>.md`
   (outside every repo) and give the user the path.
4. **Propose tickets** for confirmed defects (title + short description). Filing them on GitHub needs
   the user's OK; fixes go through the normal ticket flow.
5. Stop the servers and remove the worktree.

Shoal itself (`D:\projects\shoal`) can run the same YAML at scale (`npm run shoal -- run <url>`), but
its `run` only reads its bundled personas file and its `--provider subscription` mode reads the Claude
Code login token; use it only if the user sets that up.
