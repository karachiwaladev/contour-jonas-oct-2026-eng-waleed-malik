// Usage:
//   node evals/run.mjs                      fetch live data, run checks, exit 1 on any fail
//   node evals/run.mjs --save snap.json     ...and keep the snapshot (to re-run or attach as evidence)
//   node evals/run.mjs --snapshot snap.json re-run on a saved snapshot, no network
//   node evals/run.mjs --json               machine-readable result rows
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runChecks } from "./checks.mjs";
import { fetchSnapshot } from "./fetch.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(here, "config.json"), "utf8"));
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

const snap = opt("--snapshot")
  ? JSON.parse(readFileSync(opt("--snapshot"), "utf8"))
  : fetchSnapshot(cfg.repo, resolve(here, ".."));
if (opt("--save")) writeFileSync(opt("--save"), JSON.stringify(snap, null, 2));

const rows = runChecks(snap, cfg);
const count = (s) => rows.filter((r) => r.status === s).length;

if (args.includes("--json")) console.log(JSON.stringify(rows, null, 2));
else {
  const ICON = { pass: "✅", fail: "❌", skip: "➖" };
  let last = "";
  for (const r of rows) {
    if (r.id !== last) { console.log(`\n${r.id}  ${r.title}`); last = r.id; }
    console.log(`  ${ICON[r.status]} ${r.subject}${r.detail ? ` - ${r.detail}` : ""}`);
  }
  console.log(`\n${count("pass")} passed, ${count("fail")} failed, ${count("skip")} skipped (snapshot ${snap.fetchedAt})`);
}
process.exitCode = count("fail") ? 1 : 0;
