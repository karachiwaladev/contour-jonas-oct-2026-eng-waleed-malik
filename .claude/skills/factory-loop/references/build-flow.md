# Build flow: new project or feature

Use this for any ticket that builds a project or adds a feature to one. Small doc/config edits and
pure questions don't need it. The point is to agree on *what* before spending effort on *how*. Every
gate happens **on the GitHub issue**, because the author watches the issue, not this terminal.

A ticket moves through four phases. Work out which phase it is in from the hidden markers on the
issue's comments (all comments come from one account, so markers are the only way to tell the loop's
comments from the author's replies).

| Phase | Loop posts | Waits for | Then |
|---|---|---|---|
| 1. Clarify | questions, `<!-- factory-loop:question -->` | a reply | phase 2 |
| 2. Plan | plan, `<!-- factory-loop:plan -->` | approval | phase 3 |
| 3. Build | - | - | phase 4 |
| 4. Verify | screenshots + result, `<!-- factory-loop:result -->` | - | close |

**Waiting rule:** if the newest comment on the issue is the loop's own question or plan, there is
no reply yet. Skip the ticket silently and move on; don't re-post, don't report it as news.

## 1. Clarify

Post one comment listing the assumptions you'd otherwise make, as numbered questions, each with
your proposed default so the author can answer "defaults are fine". Cover what changes the build:
scope and must-have features, where it lives (folder), tech/stack and storage, UI expectations,
anything the ticket leaves open. Keep it to what matters; 3-7 questions.

## 2. Plan

Once the questions are answered, post a plan: what will be built, files/folders touched, the
approach, and how it will be verified (the exact checks you'll run in the browser). End by asking for
approval, e.g. "Reply **approved** to build, or comment with changes."
- Clear approval ("approved", "yes", "go ahead", "lgtm", 👍) -> phase 3.
- Anything else is feedback: revise and post an updated plan (new `factory-loop:plan` marker).

## 3. Build

Build exactly the approved plan. If you discover the plan can't work as written, stop and post a
revised plan rather than quietly building something different. Commit as `Ticket #N: ... (#<issue>)`.

## 4. Verify in the browser and attach screenshots

Verify with the Chrome browser tools (`claude-in-chrome`, the user's already-open Chrome). Load the
`mcp__claude-in-chrome__*` tools in one ToolSearch call.
1. Serve the project locally in the background (e.g. a small `node` static server or the project's
   own dev command) and note the port.
2. `tabs_context_mcp` with `createIfEmpty: true`, open the local URL in a new tab.
3. Exercise every check from the approved plan. Prefer real clicks/typing for the user-facing flow;
   `javascript_tool` is fine for reading state. Check `read_console_messages` with `onlyErrors: true`.
4. Take a screenshot of each key state with `save_to_disk: true`.
5. Close the tab and stop the server.

Then attach the screenshots to the ticket. GitHub's API can't upload images to a comment, so commit
them deliberately (these are evidence, not scratch files):
- Copy to `<project>/screenshots/ticket-<N>-<what-it-shows>.png`, commit and push.
- In the result comment, embed each one pinned to that commit so the links never break:
  `![<what it shows>](https://github.com/<repo>/blob/<sha>/<path>?raw=true)`
- List each verification check with ✅/❌. If anything failed, fix it and re-verify before closing;
  don't close a ticket with a ❌.
