# Build flow: new project or feature

Use this for any ticket that builds a project or adds a feature to one. Small doc/config edits and
pure questions don't need it. The point is to agree on *what* before spending effort on *how*, and to
let the author see the actual change before it lands on `main`.

A ticket moves through five phases. Work out which phase it is in from the hidden markers on the
issue's and PR's comments (all comments come from one account, so markers are the only way to tell the
loop's comments from the author's replies).

| Phase | Loop posts | Where | Waits for | Then |
|---|---|---|---|---|
| 1. Clarify | questions, `<!-- factory-loop:question -->` | issue | a reply | phase 2 |
| 2. Plan | plan, `<!-- factory-loop:plan -->` | issue | approval | phase 3 |
| 3. Build | commits on branch `ticket-<N>-<slug>` | - | - | phase 4 |
| 4. Verify + PR | PR with checks + screenshots, `<!-- factory-loop:pr -->` | PR (linked on issue) | PR approval | phase 5 |
| 5. Merge | result, `<!-- factory-loop:result -->` | issue | - | close |

**Waiting rule:** if the newest comment on the issue (phases 1-2) or on the PR (phase 4) is the loop's
own marker comment, there is no reply yet. Skip the ticket silently and move on; don't re-post, don't
report it as news.

**Always work from a clean, current `main`:** before starting any ticket,
`git checkout main && git pull --ff-only`. Return to `main` after pushing a branch, so other tickets
and the Stop hook don't land on a ticket branch by accident.

## 1. Clarify

Post one comment on the issue listing the assumptions you'd otherwise make, as numbered questions,
each with your proposed default so the author can answer "defaults are fine". Cover what changes the
build: scope and must-have features, where it lives (folder), tech/stack and storage, UI expectations,
anything the ticket leaves open. Keep it to what matters; 3-7 questions.

## 2. Plan

Once the questions are answered, post a plan on the issue: what will be built, files/folders touched,
the approach, how it will be verified (the exact checks you'll run in the browser), and an **Eval**
section: a numbered list of plain-language pass/fail checks that define "done" (one behaviour each,
including old data and edge cases). Approving the plan approves that eval; it is the contract. End with:
"Reply **approved** to build, or comment with changes."
- Clear approval ("approved", "yes", "go ahead", "lgtm", 👍) -> phase 3.
- Anything else is feedback: revise and post an updated plan (new `factory-loop:plan` marker).

## 3. Build (on a branch)

`git checkout -b ticket-<N>-<short-slug>` from current `main`.

**Task eval first.** Turn the approved Eval list into `<project>/evals/ticket-<N>.test.mjs`, one test
per numbered check, named after it ("E1: ..."), driving the real app the way the project's tests do.
Run it before any feature code exists: every check must **fail** (a check that passes now tests
nothing - fix it). Commit it alone as `Ticket #N: task eval (red, 0/<n>) (#<issue>)` and keep the
failing output for the PR. Process eval EV13 verifies from git that this commit comes before any
product code, and that later edits to the eval were approved on the PR.

Then build exactly the approved plan,
**test-first**: follow the `quality-gate` skill - turn the plan's checks into failing tests, then write
the code until they pass, keeping to its architecture rules. If the plan turns out not to work as
written, stop and post a revised plan on the issue rather than quietly building something different.
Commit as `Ticket #N: ... (#<issue>)`, only when the tests pass (exit code, not printed output).
Done means the task eval is fully green. Never weaken an eval check to make it pass: if a check is
wrong, say so on the PR and change it only after the author approves.

Before the browser step, finish the rest of the `quality-gate` (architecture, security, review) and
keep its ✅ list for the PR body.

## 4. Verify in the browser, then open the PR

Verify with the Chrome browser tools (`claude-in-chrome`, the user's already-open Chrome). Load the
`mcp__claude-in-chrome__*` tools in one ToolSearch call.
1. Serve the project locally in the background (e.g. a small `node` static server or the project's
   own dev command) and note the port.
2. `tabs_context_mcp` with `createIfEmpty: true`, open the local URL in a new tab.
3. Exercise every check from the approved plan. Prefer real clicks/typing for the user-facing flow;
   `javascript_tool` is fine for reading state. Check `read_console_messages` with `onlyErrors: true`
   (reload once after the first call so page-load errors are captured).
4. Take a screenshot of each key state with `save_to_disk: true`.
5. Close the tab and stop the server.

Any ❌: fix on the branch and re-verify. Don't open the PR with a failing check.

Screenshots: GitHub's API can't upload images to a comment, so commit them deliberately (evidence,
not scratch files) to `<project>/screenshots/ticket-<N>-<what-it-shows>.(png|jpg)` on the branch.

Then open the PR as in `pr-review.md`. In the body, embed each screenshot pinned to the branch
commit so the links survive the squash merge:
`![<what it shows>](https://github.com/<repo>/blob/<sha>/<path>?raw=true)`

## 5. Approval and merge

Exactly as `pr-review.md`: wait for the author's approval on the PR, squash-merge, post the result on
the issue, close it. Requested changes mean: fix on the branch, re-run tests **and the affected
browser checks**, refresh the screenshots.
