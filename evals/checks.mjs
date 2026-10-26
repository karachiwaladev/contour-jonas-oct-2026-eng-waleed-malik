// Process evals: each check is a pure function of a snapshot (GitHub + git data) -> pass/fail/skip rows.
// Same snapshot in, same verdict out. See README.md for what each rule enforces and why.
import {
  hasMarker, isAuthor, isApproval, ticketNo, imageLinks, isBuildPr, isProductFile, taskEvalPath,
  sortByTime, lastIndex, prFor,
} from "./lib.mjs";

const pass = (subject, detail = "") => ({ subject, status: "pass", detail });
const fail = (subject, detail) => ({ subject, status: "fail", detail });
const skip = (subject, detail) => ({ subject, status: "skip", detail });

const tickets = (snap) => snap.issues.filter((i) => ticketNo(i.title) !== null);
const inEra = (issue, from) => issue.number >= from;
const label = (i) => `issue #${i.number} (Ticket #${ticketNo(i.title)})`;

// Each ticket in the PR era, as { issue, comments (time-sorted), pr }.
function prEra(snap, cfg, { closedOnly = false } = {}) {
  return tickets(snap)
    .filter((i) => inEra(i, cfg.rulesFromIssue.pullRequest) && (!closedOnly || i.state === "CLOSED"))
    .map((issue) => ({ issue, comments: sortByTime(issue.comments), pr: prFor(snap, issue) }));
}

// Question -> author reply -> plan -> author approval, in that order, on the issue.
function planApprovedAt(comments) {
  const q = comments.findIndex((c) => hasMarker(c, "question"));
  const plan = lastIndex(comments, (c) => hasMarker(c, "plan"));
  if (q < 0) return { error: "no clarifying question (factory-loop:question) on the issue" };
  if (plan < 0) return { error: "no plan (factory-loop:plan) on the issue" };
  if (plan < q) return { error: "plan posted before the questions" };
  if (!comments.slice(q + 1, plan).some(isAuthor)) return { error: "plan posted before the author answered the questions" };
  const ok = comments.slice(plan + 1).find(isApproval);
  return ok ? { at: ok.createdAt } : { error: "no author approval after the latest plan" };
}

export const CHECKS = [
  {
    id: "EV01", title: "Every closed ticket has a result comment",
    run: (snap, cfg) => tickets(snap).filter((i) => i.state === "CLOSED").map((i) =>
      !inEra(i, cfg.rulesFromIssue.markers) ? skip(label(i), "before markers existed")
        : i.comments.some((c) => hasMarker(c, "result")) ? pass(label(i))
          : fail(label(i), "closed without a factory-loop:result comment")),
  },
  {
    id: "EV02", title: "Build tickets: questions answered, plan approved, before any code",
    run: (snap, cfg) => prEra(snap, cfg).map(({ issue, comments, pr }) => {
      const branch = snap.branches.find((b) => b.startsWith(`ticket-${ticketNo(issue.title)}-`));
      if (!pr && !branch) return skip(label(issue), "nothing built yet");
      if (pr && !isBuildPr(pr)) return skip(label(issue), "no product code in the PR (doc/answer ticket)");
      const plan = planApprovedAt(comments);
      if (plan.error) return fail(label(issue), plan.error);
      const firstCommit = pr && pr.commits.map((c) => c.committedDate).sort()[0];
      if (firstCommit && firstCommit < plan.at) return fail(label(issue), `first commit ${firstCommit} is before plan approval ${plan.at}`);
      return pass(label(issue), `plan approved ${plan.at}`);
    }),
  },
  {
    id: "EV03", title: "Every closed ticket went through a merged PR from a ticket branch",
    run: (snap, cfg) => prEra(snap, cfg, { closedOnly: true }).map(({ issue, pr }) => {
      if (!pr) return fail(label(issue), "no PR with `Closes #" + issue.number + "` from a ticket-* branch");
      if (!pr.mergedAt) return fail(label(issue), `PR #${pr.number} is not merged`);
      const t = ticketNo(issue.title);
      if (!pr.headRefName.startsWith(`ticket-${t}-`)) return fail(label(issue), `branch ${pr.headRefName} doesn't match ticket-${t}-*`);
      return pass(label(issue), `PR #${pr.number}`);
    }),
  },
  {
    id: "EV04", title: "Ticket closed only after its PR merged",
    run: (snap, cfg) => prEra(snap, cfg, { closedOnly: true }).map(({ issue, pr }) =>
      !pr || !pr.mergedAt ? skip(label(issue), "no merged PR (see EV03)")
        : issue.closedAt >= pr.mergedAt ? pass(label(issue))
          : fail(label(issue), `closed ${issue.closedAt}, PR merged ${pr.mergedAt}`)),
  },
  {
    id: "EV05", title: "Loop merged a PR only after the author approved it",
    run: (snap, cfg) => prEra(snap, cfg).filter((t) => t.pr && t.pr.mergedAt).map(({ issue, pr }) => {
      const cs = sortByTime(pr.comments);
      const merged = cs.findIndex((c) => hasMarker(c, "merged"));
      if (merged < 0) return pass(label(issue), `PR #${pr.number} merged by the author on GitHub`);
      const lastPr = lastIndex(cs.slice(0, merged), (c) => hasMarker(c, "pr"));
      const ok = cs.slice(lastPr + 1, merged).some(isApproval);
      return ok ? pass(label(issue), `PR #${pr.number} approved before merge`)
        : fail(label(issue), `PR #${pr.number}: loop merged with no approval comment after its latest PR summary`);
    }),
  },
  {
    id: "EV06", title: "PR body: links the ticket, quality gate all ✅, screenshots that exist",
    run: (snap, cfg) => prEra(snap, cfg).filter((t) => t.pr).map(({ issue, pr }) => {
      const b = pr.body || "";
      const problems = [];
      if (!hasMarker({ body: b }, "pr")) problems.push("no factory-loop:pr marker");
      if (!/Approve to merge/i.test(b)) problems.push("no 'Approve to merge' instruction");
      if (isBuildPr(pr)) {
        const gate = /### Quality gate([\s\S]*?)(\n#{1,3} |\n\nApprove|$)/.exec(b);
        if (!gate) problems.push("no '### Quality gate' section");
        else {
          if (/❌/.test(gate[1])) problems.push("quality gate has a ❌");
          for (const k of ["Tests", "Architecture", "Security", "Review"]) {
            if (!new RegExp(`✅\\s*\\**${k}`).test(gate[1])) problems.push(`quality gate missing ✅ ${k}`);
          }
        }
        const imgs = imageLinks(b);
        if (!imgs.length) problems.push("no screenshots embedded");
        for (const u of imgs) if (snap.images[u] !== true) problems.push(`screenshot not found: ${u}`);
      }
      return problems.length ? fail(label(issue), problems.join("; ")) : pass(label(issue), `PR #${pr.number}`);
    }),
  },
  {
    id: "EV07", title: "Ticket commits are named `Ticket #N: ...` for their own ticket",
    run: (snap, cfg) => prEra(snap, cfg).filter((t) => t.pr).map(({ issue, pr }) => {
      const t = ticketNo(issue.title);
      const bad = pr.commits.filter((c) => !c.messageHeadline.startsWith(`Ticket #${t}:`));
      return bad.length ? fail(label(issue), bad.map((c) => `${c.oid.slice(0, 7)} "${c.messageHeadline}"`).join(", "))
        : pass(label(issue), `${pr.commits.length} commits`);
    }),
  },
  {
    id: "EV08", title: "No ticket work pushed straight to main",
    run: (snap, cfg) => {
      const viaPr = new Set(snap.prs.flatMap((p) => [...p.commits.map((c) => c.oid), p.mergeCommit && p.mergeCommit.oid]).filter(Boolean));
      const eraTickets = new Set(tickets(snap).filter((i) => inEra(i, cfg.rulesFromIssue.pullRequest)).map((i) => ticketNo(i.title)));
      const direct = snap.mainCommits.filter((c) => {
        const m = /^Ticket #(\d+)/.exec(c.message);
        return m && eraTickets.has(Number(m[1])) && !viaPr.has(c.oid);
      });
      return [direct.length ? fail("main", direct.map((c) => `${c.oid.slice(0, 7)} ${c.message.split("\n")[0]}`).join("; "))
        : pass("main", `${snap.mainCommits.length} commits checked`)];
    },
  },
  {
    id: "EV09", title: "Loop waits instead of re-posting (no repeated question/plan/PR prompt without a reply)",
    run: (snap, cfg) => prEra(snap, cfg).map(({ issue, comments, pr }) => {
      const threads = [["issue", comments], ...(pr ? [[`PR #${pr.number}`, sortByTime(pr.comments)]] : [])];
      const waiting = (c) => ["question", "plan", "pr"].some((m) => hasMarker(c, m));
      for (const [where, cs] of threads) {
        let pending = false;
        for (const c of cs) {
          if (isAuthor(c)) pending = false;
          else if (waiting(c)) { if (pending) return fail(label(issue), `${where}: re-posted at ${c.createdAt} with no reply in between`); pending = true; }
        }
      }
      return pass(label(issue));
    }),
  },
  {
    id: "EV10", title: "No Co-Authored-By trailers in commits",
    run: (snap) => {
      const all = [...snap.mainCommits, ...snap.prs.flatMap((p) => p.commits.map((c) => ({ oid: c.oid, message: `${c.messageHeadline}\n${c.messageBody}` })))];
      const bad = [...new Set(all.filter((c) => /co-authored-by:/i.test(c.message)).map((c) => c.oid.slice(0, 7)))];
      return [bad.length ? fail("commits", bad.join(", ")) : pass("commits", `${all.length} checked`)];
    },
  },
  {
    id: "EV11", title: "CLAUDE.md stays an index; every project folder has a README",
    run: (snap, cfg) => {
      const { claudeMdLines, projectFolders } = snap.local;
      const rows = [claudeMdLines < cfg.claudeMdMaxLines ? pass("CLAUDE.md", `${claudeMdLines} lines`)
        : fail("CLAUDE.md", `${claudeMdLines} lines (limit ${cfg.claudeMdMaxLines})`)];
      for (const p of projectFolders) rows.push(p.hasReadme ? pass(p.folder) : fail(p.folder, "linked from CLAUDE.md index but has no README.md"));
      return rows;
    },
  },
  {
    id: "EV12", title: "No secrets committed",
    run: (snap) => [snap.local.secretHits.length
      ? fail("repo", snap.local.secretHits.map((h) => `${h.file}:${h.line} (${h.kind})`).join("; "))
      : pass("repo", `${snap.local.filesScanned} tracked files scanned`)],
  },
  {
    id: "EV13", title: "Task eval: in the approved plan, committed red before any product code, never changed unapproved",
    run: (snap, cfg) => prEra(snap, cfg)
      .filter(({ issue, pr }) => pr && isBuildPr(pr) && inEra(issue, cfg.rulesFromIssue.taskEval))
      .map(({ issue, comments, pr }) => taskEvalVerdict(issue, comments, pr)),
  },
];

function taskEvalVerdict(issue, comments, pr) {
  const t = ticketNo(issue.title);
  const plan = comments[lastIndex(comments, (c) => hasMarker(c, "plan"))];
  if (!plan || !/^#{0,4}\s*\**Eval\b/im.test(plan.body)) return fail(label(issue), "approved plan has no Eval section");
  const evalRe = taskEvalPath(t);
  const commits = [...pr.commits].sort((a, b) => a.committedDate.localeCompare(b.committedDate));
  const touchesEval = (c) => (c.files || []).some((f) => evalRe.test(f));
  const touchesProduct = (c) => (c.files || []).some(isProductFile);
  const firstEval = commits.findIndex(touchesEval);
  if (firstEval < 0) return fail(label(issue), `no task eval file <project>/evals/ticket-${t}.test.mjs in the PR`);
  const firstProduct = commits.findIndex(touchesProduct);
  if (firstProduct >= 0 && firstProduct <= firstEval) {
    return fail(label(issue), `product code (${commits[firstProduct].oid.slice(0, 7)}) committed before or with the task eval`);
  }
  // After code exists, any change to the eval needs an author approval on the PR after that commit.
  const prComments = sortByTime(pr.comments);
  const unapproved = commits.slice(firstProduct < 0 ? commits.length : firstProduct)
    .filter(touchesEval)
    .filter((c) => !prComments.some((pc) => pc.createdAt > c.committedDate && isApproval(pc)));
  if (unapproved.length) return fail(label(issue), `eval changed after code without approval: ${unapproved.map((c) => c.oid.slice(0, 7)).join(", ")}`);
  const section = /### Task eval([\s\S]*?)(\n#{1,3} |$)/.exec(pr.body || "");
  if (!section) return fail(label(issue), "PR body has no '### Task eval' section");
  if (/❌/.test(section[1]) || !/✅/.test(section[1])) return fail(label(issue), "task eval section is not all ✅");
  return pass(label(issue), `eval ${commits[firstEval].oid.slice(0, 7)} before code`);
}

export function runChecks(snap, cfg) {
  return CHECKS.flatMap((c) => c.run(snap, cfg).map((r) => ({ id: c.id, title: c.title, ...r })));
}

