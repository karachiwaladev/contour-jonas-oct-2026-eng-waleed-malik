---
name: factory-loop
description: Work through the workshop tickets (GitHub Issues on this repo) end to end - pick up each open ticket, acknowledge it, do the work, post the result, commit/push any files, and close it. Use this whenever the user says "check the tickets", "pick up the next ticket", "run the loop", "any new issues?", "work the queue", mentions Ticket #N, or a Slack step asks to process tickets, even if they don't say "factory-loop".
---

# Factory loop

Tickets for this workshop arrive as GitHub Issues titled `Ticket #N: ...`. Only what lands on GitHub
is scored (issue comments, closed issues, commits on `main`), so every ticket must end with a visible
trace there - work that stays local scores zero.

Running this skill is the user's approval for the GitHub writes below **on this repo only**
(reactions, comments, closing issues, pushing to `main`). It does not extend to any other repo or system.

## Setup

- Repo: `karachiwaladev/contour-jonas-oct-2026-eng-waleed-malik`
- CLI: `gh`. If `gh` isn't on PATH (session started before install), call it by full path:
  `"/c/Program Files/GitHub CLI/gh.exe"` in bash.
- Check `gh auth status` first. If not logged in, stop and tell the user to run, in a normal
  PowerShell window: `& "C:\Program Files\GitHub CLI\gh.exe" auth login --web --git-protocol https`
  (the `!` prefix in Claude Code can't handle the interactive device-code flow).

## Steps, per open ticket (oldest first)

1. **Find work**: `gh issue list --repo <repo> --state open --json number,title,createdAt`.
   No open issues -> say so and stop.
2. **Read it**: `gh issue view N --repo <repo> --json title,body,comments`. Read the comments too -
   follow-up instructions often live there.
3. **Acknowledge** (skip if a "Picked up" comment already exists):
   - `gh api -X POST repos/<repo>/issues/N/reactions -f content=eyes`
   - `gh issue comment N --repo <repo> --body "👀 Picked up — working on it. <!-- factory-loop:ack -->"`
3a. **Unclear ticket? Ask on the issue, not in chat.** The ticket author watches the issue, not this
   terminal, and the question/answer trail on GitHub is part of the scored record.
   - Post one comment with the specific question and the options you see, ending in
     `<!-- factory-loop:question -->`. Then move on to the next ticket - don't block the loop.
   - On later runs: if the newest comment is the loop's own `factory-loop:question` or `factory-loop:plan`, skip
     the ticket silently (don't re-ask, don't report it as news). If someone replied, use the reply and continue.
   - Every comment comes from the same GitHub account, so the hidden `<!-- factory-loop:... -->` markers
     are the only way to tell the loop's own comments from the author's replies - always include them.
4. **Do the work - act, don't just reply.** A ticket is done when the thing it asks for exists in the
   repo, not when it has been described. Read every ticket for the deliverable:
   - Pure question -> answer it accurately and concisely, with the source/figure where useful.
   - Asks for something to exist (a file, doc, config, script, project, app, test...) -> build it in this
     repo. A new project gets its own top-level folder (the name the ticket gives) with a `README.md`, and a
     row in the `CLAUDE.md` index. Verify it works (run it, open it in the browser, run its tests) before
     reporting done.
   - Both (e.g. "answer X and save it to a file") -> do both.
   - **Builds a project or a feature in one** -> follow `references/build-flow.md`: clarifying questions
     on the issue, then a plan the author approves, then build, then verify in Chrome and attach
     screenshots to the ticket. Read that file before starting such a ticket.
   - Commit with subject `Ticket #N: <what changed> (#<issue>)` (no Co-Authored-By trailer) and
     `git push origin main`. The Stop hook also auto-commits as a safety net, but a per-ticket commit keeps
     the history readable for reviewers.
5. **Post the result** as a comment: the answer, or a short summary of what changed plus the commit SHA.
   Lead with the answer in bold and end with `<!-- factory-loop:result -->`. Example:
   `**Karachi** — largest city in Pakistan by population (~20.4M, 2023 census). <!-- factory-loop:result -->`
6. **Close**: `gh issue close N --repo <repo> --reason completed`.
7. Report to the user in one line per ticket: number, title, answer/change (or "asked on issue"),
   link to the comment. If nothing changed this run, say so in one line.

## Non-destructive only

The loop runs unattended, so anything it does must be safe to leave and easy to undo with a new commit.
- Allowed: create files/folders, edit files the ticket is about, add commits, push to `main`, comment on
  and close the ticket being worked.
- Never: delete or overwrite files the ticket doesn't own, `rm -rf`, `git push --force`, `git reset --hard`,
  rewrite history, delete branches, delete/edit/transfer issues, change repo settings, touch other repos,
  or add real secrets/keys.
- If a ticket genuinely needs one of those, don't do it - ask on the issue (step 3a) and say what you'd run.

## Notes

- Never skip step 6 or the push in step 4 - unpushed or unclosed work doesn't count.
- Don't re-do closed tickets unless the user asks; a passed check stays passed.
- Keep comments short and factual; no names of people (refer to roles).
