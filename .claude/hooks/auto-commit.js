// Stop hook: log new prompts, then commit and push whatever changed.
// One script instead of two hook entries because Claude Code runs hooks for the same event in
// parallel, and the prompt log must be written before the commit picks it up.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const raw = fs.readFileSync(0, "utf8") || "{}";
const input = JSON.parse(raw);
const repo = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const say = (msg) => { console.log(JSON.stringify({ systemMessage: msg })); process.exit(0); };
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

try {
  execFileSync("node", [path.join(__dirname, "log-prompts.js")], { input: raw, cwd: repo });
} catch {} // a logging failure must never block the commit

const changed = git("status", "--porcelain").split("\n").filter(Boolean);
// The prompt log changes on every stop; committing it alone would add a commit per reply.
// It rides along with the next real change instead.
const real = changed.filter((l) => !l.endsWith(".claude/logs/prompts.jsonl"));
if (!real.length) process.exit(0);

git("add", "-A");
const diff = git("diff", "--cached");
// Last line of defence for the "no real keys" rule: GitHub tokens, AWS keys, private keys.
if (/gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(diff)) {
  git("reset", "-q");
  say("Auto-commit skipped: staged changes look like they contain a secret. Review and commit by hand.");
}

const files = git("diff", "--cached", "--name-only").split("\n").filter(Boolean);
const subject = `Auto-commit on stop: ${files.length} file${files.length === 1 ? "" : "s"}`;
git("commit", "-q", "-m", subject, "-m", files.slice(0, 20).join("\n"));
const sha = git("rev-parse", "--short", "HEAD");

try {
  git("push", "-q", "origin", "HEAD");
  say(`Auto-committed and pushed ${sha} (${files.length} file${files.length === 1 ? "" : "s"}).`);
} catch (e) {
  say(`Auto-committed ${sha} but push failed: ${String(e.stderr || e.message).trim().split("\n")[0]}`);
}
