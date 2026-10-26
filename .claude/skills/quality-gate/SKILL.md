---
name: quality-gate
description: The checks every code change must pass before its PR opens - test-first (TDD) with test cases generated from the approved plan, architecture rules (no god objects, logic separated from UI and storage), a security pass, and a code review. Use it whenever code is about to be committed for a ticket or a PR is about to be opened, when the user asks to check quality, architecture, security or tests, or when factory-loop reaches its build step.
---

# Quality gate

Runs between "build" and "open PR" in `factory-loop`. Its output - a ✅/❌ list - goes into the PR body,
so the reviewer sees what was checked without re-running it. A ❌ blocks the PR: fix it, or, if it's a
deliberate trade-off, say so in the PR and ask the author.

Keep it proportional. These rules exist to keep small projects easy to change, not to add ceremony:
a one-line doc fix only needs step 4; a new feature needs all of them.

## 1. Tests first (TDD) - generated from the plan

Use the `superpowers:test-driven-development` skill for the cycle. Where the test cases come from:
- Every verification check in the approved plan becomes at least one automated test where the logic
  allows it (pure functions, data transforms, date maths). Browser-only checks stay in the Chrome step.
- Add the edge cases the plan implies: empty input, boundaries (dates at month ends, today vs
  yesterday), duplicates, old data missing new fields.
- Write the test, run it, **see it fail**, then write the code until it passes.

Gate: the project's test command exits 0 (check the exit code, not the printed output), and every
plan check is covered by a test or by the Chrome verification.

## 2. Architecture - no god objects

A god object is one file/class/function that knows and does everything; every change touches it and
breaks something else. Rules:
- **Separate concerns:** pure logic (no DOM, no storage) in its own module and unit-tested; storage
  behind a small API; UI code only renders and wires events. In `todo/` that's `tasks.js` / `db.js` /
  `app.js`.
- **One job per file.** If you can't describe a file in one sentence without "and", split it.
- **Size signals, not hard limits:** a file over ~200 lines or a function over ~40 lines is a prompt
  to look for a split. Don't split just to hit a number - split along a real responsibility.
- **No new shared mutable state** beyond one small state object per screen.
- Don't add frameworks, build steps or dependencies the plan didn't approve.

Run the `simplify` skill on the changed code for reuse/duplication/over-complexity, and apply what
holds up.

Gate: report the line counts of the changed files and any split made or deliberately not made.

## 3. Security

Run the `security-review` skill on the branch's changes. Plus this checklist for client-side apps:
- [ ] No `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` with user-supplied data -
      use `textContent` or DOM nodes (`grep -nE "innerHTML|outerHTML|insertAdjacentHTML|document\.write"`).
- [ ] No `eval`, `new Function`, or string `setTimeout`.
- [ ] No secrets, tokens or keys in code, tests, fixtures or screenshots.
- [ ] No new external scripts/CDNs or network calls the plan didn't approve.
- [ ] Untrusted input (form fields, stored data, URL params) is validated or normalised before use.
- [ ] Storage access (`localStorage`/IndexedDB) handles failure without breaking the page.

Gate: checklist all ✅, and the `security-review` findings fixed or explained.

## 4. Review

Run the `code-review` skill on the diff against `main` (`git diff main...HEAD`). Fix real bugs it finds;
note anything you choose not to change and why.

## Output for the PR body

```
### Task eval
- ✅ `<project>/evals/ticket-<N>.test.mjs`: 0/<n> before code (red commit <sha>) → <n>/<n> after
- ✅ Mutation: <score>% of injected bugs in the changed files caught by tests + eval (Stryker)

### Quality gate
- ✅ Tests: <n> passing (`<command>`), <n> new, written test-first from plan checks <list>
- ✅ Architecture: <files + line counts>; <split made / why none needed>
- ✅ Security: checklist clean; security-review: <n findings, all fixed | none>
- ✅ Review: code-review: <n findings fixed>, <n noted>
```
