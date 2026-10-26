// Stop hook: append the session's new user prompts to .claude/logs/prompts.jsonl.
// Reads the transcript each stop and dedupes by uuid against what's already logged,
// so re-runs and resumed sessions never write a prompt twice.
const fs = require("fs");
const path = require("path");

const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const transcript = input.transcript_path;
if (!transcript || !fs.existsSync(transcript)) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const outFile = path.join(projectDir, ".claude", "logs", "prompts.jsonl");
fs.mkdirSync(path.dirname(outFile), { recursive: true });

const seen = new Set();
if (fs.existsSync(outFile)) {
  for (const line of fs.readFileSync(outFile, "utf8").split("\n")) {
    try { seen.add(JSON.parse(line).uuid); } catch {}
  }
}

// Command output / caveat wrappers are user-typed entries in the transcript but aren't prompts.
const NOT_PROMPT = /^\s*<(local-command-stdout|local-command-caveat|bash-stdout|bash-stderr)>/;

const out = [];
for (const line of fs.readFileSync(transcript, "utf8").split("\n")) {
  let e;
  try { e = JSON.parse(line); } catch { continue; }
  if (e.type !== "user" || e.isMeta || seen.has(e.uuid)) continue;
  const c = e.message && e.message.content;
  let text = null;
  if (typeof c === "string") text = c;
  else if (Array.isArray(c) && !c.some((b) => b.type === "tool_result"))
    text = c.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  if (!text || !text.trim() || NOT_PROMPT.test(text)) continue;
  seen.add(e.uuid);
  out.push(JSON.stringify({
    timestamp: e.timestamp,
    session_id: e.sessionId || input.session_id,
    uuid: e.uuid,
    source: (e.origin && e.origin.kind) || e.promptSource || "command",
    prompt: text,
  }));
}

if (out.length) fs.appendFileSync(outFile, out.join("\n") + "\n");
