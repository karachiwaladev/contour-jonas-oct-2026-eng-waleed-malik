// Tests for the evals themselves: a known-good ticket history must pass every check, and each rule
// broken on purpose must make exactly that check fail. Guards against checks that can never fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECKS, runChecks } from "./checks.mjs";
import { isApproval, markers, closesIssue, ticketNo, isBuildPr } from "./lib.mjs";

const cfg = { rulesFromIssue: { markers: 3, pullRequest: 6 }, claudeMdMaxLines: 100 };
const REPO = "o/r";
const IMG = `https://github.com/${REPO}/blob/abc/todo/screenshots/t.png?raw=true`;
const c = (createdAt, body) => ({ createdAt, body });
const loop = (t, m, text = "x") => c(t, `${text} <!-- factory-loop:${m} -->`);

const GATE = "### Quality gate\n- ✅ Tests: 3\n- ✅ Architecture: ok\n- ✅ Security: clean\n- ✅ Review: none\n";
const PR_BODY = `Closes #20\n\n![shot](${IMG})\n\n${GATE}\nApprove to merge: comment **merge**.\n\n<!-- factory-loop:pr -->`;

// Issue #20 = Ticket #17, built through PR #21 exactly as the loop's rules say. Bystanders: an older
// ticket from before the PR rule (#5) and a non-ticket issue (#2), which the PR-era rules must ignore.
function good() {
  return {
    issues: [{
      number: 20, title: "Ticket #17: Thing", state: "CLOSED", createdAt: "2026-01-01T00:00:00Z", closedAt: "2026-01-01T05:00:00Z",
      comments: [
        loop("2026-01-01T00:01:00Z", "question"), c("2026-01-01T00:02:00Z", "defaults are fine"),
        loop("2026-01-01T00:03:00Z", "plan"), c("2026-01-01T00:04:00Z", "approved"),
        loop("2026-01-01T05:00:01Z", "result"),
      ],
    }, {
      number: 5, title: "Ticket #3: Old", state: "CLOSED", createdAt: "2025-12-01T00:00:00Z", closedAt: "2025-12-01T01:00:00Z",
      comments: [loop("2025-12-01T01:00:00Z", "result")],
    }, {
      number: 2, title: "Which city is smallest?", state: "CLOSED", createdAt: "2025-11-01T00:00:00Z", closedAt: "2025-11-01T01:00:00Z",
      comments: [],
    }],
    prs: [{
      number: 21, headRefName: "ticket-17-thing", state: "MERGED", mergedAt: "2026-01-01T04:59:00Z",
      body: PR_BODY, mergeCommit: { oid: "m1" },
      comments: [c("2026-01-01T04:00:00Z", "merge"), loop("2026-01-01T04:58:00Z", "merged")],
      commits: [{ oid: "c1", messageHeadline: "Ticket #17: Build it (#10)", messageBody: "", committedDate: "2026-01-01T01:00:00Z" }],
      files: [{ path: "todo/app.js" }],
    }],
    branches: ["main", "ticket-17-thing"],
    mainCommits: [{ oid: "m1", message: "Ticket #17: Thing (#11)" }, { oid: "x0", message: "Initial commit" }],
    images: { [IMG]: true },
    local: { claudeMdLines: 60, projectFolders: [{ folder: "todo", hasReadme: true }], secretHits: [], filesScanned: 5 },
  };
}

const result = (snap, id) => runChecks(snap, cfg).filter((r) => r.id === id);
const statuses = (snap, id) => result(snap, id).map((r) => r.status);
function breaks(id, mutate, detail) {
  const s = good();
  mutate(s);
  const rows = result(s, id);
  assert.ok(rows.some((r) => r.status === "fail"), `${id} should fail`);
  if (detail) assert.match(rows.find((r) => r.status === "fail").detail, detail);
}

test("a history that follows every rule passes every check", () => {
  const rows = runChecks(good(), cfg);
  assert.deepEqual(rows.filter((r) => r.status !== "pass"), []);
  assert.equal(new Set(rows.map((r) => r.id)).size, CHECKS.length);
});

test("lib: markers, approval words, ticket/issue numbers", () => {
  assert.deepEqual(markers("a <!-- factory-loop:ack --> <!--factory-loop:question-->"), ["ack", "question"]);
  for (const ok of ["approved", "Approve", "merge", "**merge**", "LGTM", "ship it", "yes", "go ahead", "👍", "approved!"]) assert.ok(isApproval(c("t", ok)), ok);
  for (const no of ["yes but rename it", "not approved", "merge after fixing X", "approved <!-- factory-loop:plan -->", ""]) assert.ok(!isApproval(c("t", no)), no);
  assert.equal(ticketNo("Ticket #12: x"), 12);
  assert.equal(ticketNo("Which city?"), null);
  assert.equal(closesIssue("Closes #8\nmore"), 8);
  assert.equal(closesIssue("no link"), null);
  assert.ok(isBuildPr({ files: [{ path: "todo/app.js" }] }));
  assert.ok(!isBuildPr({ files: [{ path: "answers/ticket-3.md" }, { path: "evals/x.mjs" }, { path: "todo/README.md" }] }));
});

test("EV01: closed ticket without a result comment fails; pre-marker issues skip", () => {
  breaks("EV01", (s) => s.issues[0].comments.pop(), /result/);
  const s = good();
  s.issues[0].number = 2;
  assert.equal(result(s, "EV01").find((r) => r.subject.startsWith("issue #2 ")).status, "skip");
});

test("EV02: every out-of-order clarify/plan step fails", () => {
  breaks("EV02", (s) => { s.issues[0].comments.splice(0, 2); }, /no clarifying question/);
  breaks("EV02", (s) => { s.issues[0].comments.splice(2, 2); }, /no plan/);
  breaks("EV02", (s) => { s.issues[0].comments.splice(1, 1); }, /before the author answered/);
  breaks("EV02", (s) => { s.issues[0].comments[3].body = "yes but use red"; }, /no author approval/);
  breaks("EV02", (s) => { s.prs[0].commits[0].committedDate = "2026-01-01T00:03:30Z"; }, /before plan approval/);
  // Approval of an older plan doesn't carry over to a revised plan.
  breaks("EV02", (s) => { s.issues[0].comments.splice(4, 0, loop("2026-01-01T00:05:00Z", "plan")); }, /no author approval/);
  breaks("EV02", (s) => { s.issues[0].comments = [loop("2026-01-01T00:03:00Z", "plan"), loop("2026-01-01T00:04:00Z", "question")]; }, /before the questions/);
});

test("EV02: a branch pushed before plan approval on an open ticket fails; nothing built yet skips", () => {
  const s = good();
  s.prs = [];
  s.issues[0].state = "OPEN";
  s.issues[0].comments = s.issues[0].comments.slice(0, 3);
  assert.deepEqual(statuses(s, "EV02"), ["fail"]);
  s.branches = ["main"];
  assert.deepEqual(statuses(s, "EV02"), ["skip"]);
});

test("EV02: doc-only PRs don't need a plan", () => {
  const s = good();
  s.prs[0].files = [{ path: "answers/ticket-17.md" }];
  s.issues[0].comments = [loop("2026-01-01T05:00:01Z", "result")];
  assert.deepEqual(statuses(s, "EV02"), ["skip"]);
});

test("EV03: closed with no PR, unmerged PR, or wrong branch name fails", () => {
  breaks("EV03", (s) => { s.prs = []; }, /no PR/);
  breaks("EV03", (s) => { s.prs[0].mergedAt = null; }, /not merged/);
  breaks("EV03", (s) => { s.prs[0].headRefName = "ticket-18-thing"; }, /doesn't match/);
  breaks("EV03", (s) => { s.prs[0].headRefName = "feature-thing"; }, /no PR/);
  breaks("EV03", (s) => { s.prs[0].body = s.prs[0].body.replace("Closes #20", ""); }, /no PR/);
});

test("EV04: ticket closed before its PR merged fails", () => {
  breaks("EV04", (s) => { s.issues[0].closedAt = "2026-01-01T04:00:00Z"; }, /closed/);
});

test("EV05: loop merge with no approval after its latest PR summary fails; author merge passes", () => {
  breaks("EV05", (s) => { s.prs[0].comments = [loop("2026-01-01T04:58:00Z", "merged")]; });
  breaks("EV05", (s) => { s.prs[0].comments.splice(1, 0, loop("2026-01-01T04:30:00Z", "pr")); });
  breaks("EV05", (s) => { s.prs[0].comments[0].body = "merge after renaming"; });
  const s = good();
  s.prs[0].comments = [];
  assert.deepEqual(statuses(s, "EV05"), ["pass"]);
});

test("EV06: PR body gaps fail", () => {
  breaks("EV06", (s) => { s.prs[0].body = s.prs[0].body.replace("<!-- factory-loop:pr -->", ""); }, /marker/);
  breaks("EV06", (s) => { s.prs[0].body = s.prs[0].body.replace("Approve to merge", "Thanks"); }, /Approve to merge/);
  breaks("EV06", (s) => { s.prs[0].body = s.prs[0].body.replace(GATE, ""); }, /Quality gate/);
  breaks("EV06", (s) => { s.prs[0].body = s.prs[0].body.replace("✅ Security", "❌ Security"); }, /❌/);
  breaks("EV06", (s) => { s.prs[0].body = s.prs[0].body.replace("- ✅ Review: none\n", ""); }, /✅ Review/);
  breaks("EV06", (s) => { s.prs[0].body = s.prs[0].body.replace(`![shot](${IMG})`, ""); }, /no screenshots/);
  breaks("EV06", (s) => { s.images[IMG] = false; }, /not found/);
  // A doc-only PR needs no gate or screenshots.
  const s = good();
  s.prs[0].files = [{ path: "answers/ticket-17.md" }];
  s.prs[0].body = "Closes #20\nApprove to merge: comment merge.\n<!-- factory-loop:pr -->";
  assert.deepEqual(statuses(s, "EV06"), ["pass"]);
});

test("EV07: a commit named for another ticket, or unnamed, fails", () => {
  breaks("EV07", (s) => { s.prs[0].commits[0].messageHeadline = "Ticket #18: oops"; }, /Ticket #18/);
  breaks("EV07", (s) => { s.prs[0].commits.push({ oid: "c2", messageHeadline: "fix", messageBody: "", committedDate: "2026-01-01T02:00:00Z" }); }, /fix/);
});

test("EV08: a ticket commit on main that no PR carries fails; older eras and other commits don't", () => {
  breaks("EV08", (s) => s.mainCommits.push({ oid: "d1", message: "Ticket #17: sneaky direct push" }), /d1/);
  const s = good();
  s.mainCommits.push({ oid: "d2", message: "Ticket #3: before PR rule" }, { oid: "d3", message: "Harness: tweak skill" });
  assert.deepEqual(statuses(s, "EV08"), ["pass"]);
});

test("EV09: re-posting a waiting prompt with no reply in between fails", () => {
  breaks("EV09", (s) => { s.issues[0].comments.splice(1, 0, loop("2026-01-01T00:01:30Z", "question")); }, /issue: re-posted/);
  breaks("EV09", (s) => { s.prs[0].comments = [loop("2026-01-01T03:00:00Z", "pr"), loop("2026-01-01T03:10:00Z", "pr")]; }, /PR #21: re-posted/);
  const s = good();
  s.prs[0].comments = [loop("2026-01-01T03:00:00Z", "pr"), c("2026-01-01T03:05:00Z", "rename it"), loop("2026-01-01T03:10:00Z", "pr")];
  assert.deepEqual(statuses(s, "EV09"), ["pass"]);
});

test("EV10: a Co-Authored-By trailer anywhere fails", () => {
  breaks("EV10", (s) => { s.mainCommits[1].message += "\n\nCo-Authored-By: Bot <b@x>"; }, /x0/);
  breaks("EV10", (s) => { s.prs[0].commits[0].messageBody = "co-authored-by: bot"; }, /c1/);
});

test("EV11: oversized CLAUDE.md or a project folder with no README fails", () => {
  breaks("EV11", (s) => { s.local.claudeMdLines = 100; }, /limit 100/);
  breaks("EV11", (s) => { s.local.projectFolders.push({ folder: "shop", hasReadme: false }); }, /README/);
});

test("EV12: any secret hit fails", () => {
  breaks("EV12", (s) => { s.local.secretHits.push({ file: "a.js", line: 3, kind: "AWS key" }); }, /a\.js:3/);
});

test("checks never throw on an empty repository", () => {
  const empty = { issues: [], prs: [], branches: [], mainCommits: [], images: {}, local: { claudeMdLines: 1, projectFolders: [], secretHits: [], filesScanned: 0 } };
  assert.ok(runChecks(empty, cfg).every((r) => r.status === "pass"));
});

test("rows always name the check and what was checked", () => {
  const s = good();
  s.local.secretHits.push({ file: "a.js", line: 1, kind: "AWS key" });
  for (const r of runChecks(s, cfg)) {
    assert.ok(r.title && r.subject, `${r.id} row missing title/subject`);
    if (r.status !== "pass") assert.ok(r.detail, `${r.id} ${r.status} without a reason`);
  }
  assert.deepEqual(result(good(), "EV02").map((r) => r.subject), ["issue #20 (Ticket #17)"]);
});

test("comments returned out of order are judged by time, not position", () => {
  const s = good();
  s.issues[0].comments.reverse();
  s.prs[0].comments.reverse();
  assert.deepEqual(runChecks(s, cfg).filter((r) => r.status !== "pass"), []);
});

test("rule eras: the cut-off issue is included, older and non-ticket issues are not", () => {
  const s = good();
  s.issues[0].number = 6;
  s.prs[0].body = s.prs[0].body.replace("Closes #20", "Closes #6");
  assert.deepEqual(statuses(s, "EV03"), ["pass"]);
  // Old ticket #3 and non-ticket issue #2 have no PR and no plan, yet nothing PR-era fails for them.
  const subjects = runChecks(good(), cfg).map((r) => r.subject);
  assert.ok(!subjects.some((x) => /#2 /.test(x) || x === "issue #2"));
  assert.ok(subjects.includes("issue #5 (Ticket #3)")); // EV01 still applies to it
  assert.equal(result(good(), "EV03").length, 1);
});

test("open tickets: no result/PR needed yet; only closed ones are judged on those", () => {
  const s = good();
  s.issues.push({ number: 22, title: "Ticket #18: Next", state: "OPEN", createdAt: "2026-02-01T00:00:00Z", closedAt: null,
    comments: [loop("2026-02-01T00:01:00Z", "question")] });
  for (const id of ["EV01", "EV03", "EV04"]) assert.ok(!result(s, id).some((r) => r.subject.startsWith("issue #22")), id);
  assert.deepEqual(result(s, "EV02").find((r) => r.subject.startsWith("issue #22")).status, "skip");
});

test("EV02: earliest commit is used even if listed last", () => {
  breaks("EV02", (s) => s.prs[0].commits.push({ oid: "c0", messageHeadline: "Ticket #17: early", messageBody: "", committedDate: "2026-01-01T00:03:30Z" }), /before plan approval/);
});

test("EV04: closing in the same second as the merge is fine", () => {
  const s = good();
  s.issues[0].closedAt = s.prs[0].mergedAt;
  assert.deepEqual(statuses(s, "EV04"), ["pass"]);
});

test("EV06: each of the four gate lines is required", () => {
  for (const k of ["Tests", "Architecture", "Security", "Review"]) {
    breaks("EV06", (s) => { s.prs[0].body = s.prs[0].body.replace(new RegExp(`- ✅ ${k}:[^\n]*\n`), ""); }, new RegExp(`✅ ${k}`));
  }
});

test("EV08: a PR commit landed by rebase (not the merge commit) counts as via PR", () => {
  const s = good();
  s.mainCommits.push({ oid: "c1", message: "Ticket #17: Build it" });
  assert.deepEqual(statuses(s, "EV08"), ["pass"]);
  breaks("EV08", (s2) => s2.mainCommits.push({ oid: "z9", message: "Ticket #17: direct" }), /z9 Ticket #17: direct$/);
});

test("EV09: re-posting a plan, or any waiting prompt after an ack, is judged correctly", () => {
  breaks("EV09", (s) => { s.issues[0].comments.splice(3, 0, loop("2026-01-01T00:03:30Z", "plan")); }, /re-posted/);
  const s = good();
  s.issues[0].comments.unshift(loop("2026-01-01T00:00:30Z", "ack"));
  assert.deepEqual(statuses(s, "EV09"), ["pass"]);
});

test("lib: near-miss words and paths", () => {
  for (const no of ["disapproved", "mergeable", "unmerge", "yesterday"]) assert.ok(!isApproval(c("t", no)), no);
  assert.ok(isApproval(c("t", "  approved\n")));
  assert.equal(ticketNo("Re: Ticket #3"), null);
  assert.equal(ticketNo("Ticket #123: big"), 123);
  assert.ok(!isBuildPr({ files: [{ path: "todo/data.json" }] }));
  assert.ok(isBuildPr({ files: [{ path: "todo/answers/x.js" }] }));
  assert.ok(isBuildPr({ files: [{ path: "todo/README.md" }, { path: "todo/app.js" }] }));
  const s = good();
  s.prs[0].headRefName = "my-ticket-17-thing";
  assert.deepEqual(statuses(s, "EV03"), ["fail"]);
});

test("EV07/EV10: failure detail lists short SHAs", () => {
  breaks("EV07", (s) => { s.prs[0].commits[0].oid = "abcdef1234"; s.prs[0].commits[0].messageHeadline = "wip"; }, /^abcdef1 "wip"$/);
  breaks("EV10", (s) => { s.mainCommits[1].oid = "1234567890"; s.mainCommits[1].message += "\nCo-Authored-By: x"; }, /^1234567$/);
});
