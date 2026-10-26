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
the approach, and how it will be verified (the exact checks you'll run in the browser). End with:
"Reply **approved** to build, or comment with changes."
- Clear approval ("approved", "yes", "go ahead", "lgtm", 👍) -> phase 3.
- Anything else is feedback: revise and post an updated plan (new `factory-loop:plan` marker).

## 3. Build (on a branch)

`git checkout -b ticket-<N>-<short-slug>` from current `main`. Build exactly the approved plan. If the
plan turns out not to work as written, stop and post a revised plan on the issue rather than quietly
building something different. Commit as `Ticket #N: ... (#<issue>)`. Run the project's tests and only
commit when they pass - check the test command's exit code, not its printed output.

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

Push the branch and open the PR:
- `gh pr create --base main --head ticket-<N>-<slug> --title "Ticket #N: <title>" --body ...`
- Body: `Closes #<issue>`, a short summary of the change, the ✅ list of checks, and each screenshot
  embedded pinned to the branch commit so links survive the squash merge:
  `![<what it shows>](https://github.com/<repo>/blob/<sha>/<path>?raw=true)`. End the body with
  `<!-- factory-loop:pr -->`, and ask: "Approve to merge: comment **merge** (or **approved**), or
  comment with changes."
- On the issue, post a short comment linking the PR (no waiting marker there - the PR is now where
  the conversation happens).
- `git checkout main`.

## 5. Approval and merge

Read the PR: `gh pr view <pr> --json state,reviews,comments`.
- **Approved** - a review with state `APPROVED`, or a comment newer than the loop's last marker saying
  "merge", "approved", "lgtm", "ship it" or 👍. GitHub doesn't let an account approve its own PR, and
  the loop and the author share one account, so the comment form is the normal path.
  -> `gh pr merge <pr> --squash` (keep the branch: it holds the pinned screenshot commits).
  `git checkout main && git pull --ff-only`.
- **Already merged by the author** -> nothing to merge, continue to the result.
- **Changes requested** (any other reply, or a `CHANGES_REQUESTED` review) -> check out the branch,
  make the changes, re-run tests and the affected browser checks, push, post an updated ✅ list and
  screenshots on the PR ending with a new `<!-- factory-loop:pr -->` marker, return to `main`.
- **Closed without merging** -> ask on the issue whether to drop the ticket or redo it; don't reopen.

After the merge, post the result on the issue (summary, PR link, merge commit SHA, ending
`<!-- factory-loop:result -->`) and close it if `Closes #` hasn't already.
