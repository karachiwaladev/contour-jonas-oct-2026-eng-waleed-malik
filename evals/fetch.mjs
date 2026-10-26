// Builds the snapshot the checks run on: GitHub issues/PRs/branches/commits via `gh`, plus the local
// working tree (CLAUDE.md, project folders, secret scan). Read-only: no writes to GitHub or git.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { imageLinks } from "./lib.mjs";

const WIN_GH = "C:/Program Files/GitHub CLI/gh.exe";
const GH = process.env.GH_BIN || (process.platform === "win32" && existsSync(WIN_GH) ? WIN_GH : "gh");
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 << 20, ...opts });
const gh = (...args) => JSON.parse(run(GH, args));

const SECRET_PATTERNS = {
  "GitHub token": /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{22,}/,
  "AWS key": /\bAKIA[0-9A-Z]{16}\b/,
  "OpenAI/Anthropic key": /\bsk-(ant-)?[A-Za-z0-9_-]{20,}/,
  "Slack token": /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  "Private key": /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
};
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|zip)$/i;

function scanLocal(root) {
  const files = run("git", ["ls-files"], { cwd: root }).split("\n").filter(Boolean);
  const secretHits = [];
  let filesScanned = 0;
  for (const file of files.filter((f) => !BINARY.test(f))) {
    filesScanned++;
    readFileSync(`${root}/${file}`, "utf8").split("\n").forEach((text, i) => {
      for (const [kind, re] of Object.entries(SECRET_PATTERNS)) if (re.test(text)) secretHits.push({ file, line: i + 1, kind });
    });
  }
  const NOT_PROJECT = new Set(["answers", "evals"]);
  const folders = [...new Set(files.filter((f) => f.includes("/")).map((f) => f.split("/")[0]))]
    .filter((d) => !d.startsWith(".") && !NOT_PROJECT.has(d));
  return {
    claudeMdLines: readFileSync(`${root}/CLAUDE.md`, "utf8").split("\n").filter((l, i, a) => i < a.length - 1 || l).length,
    projectFolders: folders.map((folder) => ({ folder, hasReadme: files.includes(`${folder}/README.md`) })),
    secretHits,
    filesScanned,
  };
}

// https://github.com/<repo>/blob/<sha>/<path>?raw=true -> does that file exist at that commit?
function imageExists(repo, url) {
  const m = new RegExp(`^https://github\\.com/${repo}/blob/([^/]+)/([^?#]+)`).exec(url);
  if (!m) return false;
  try { run(GH, ["api", `repos/${repo}/contents/${m[2]}?ref=${m[1]}`, "--jq", ".sha"], { stdio: "pipe" }); return true; } catch { return false; }
}

export function fetchSnapshot(repo, root) {
  const issues = gh("issue", "list", "--repo", repo, "--state", "all", "--limit", "500",
    "--json", "number,title,state,createdAt,closedAt,comments");
  // Per PR: asking for commits/files on the list call exceeds GitHub's GraphQL node limit.
  const prs = gh("pr", "list", "--repo", repo, "--state", "all", "--limit", "500", "--json", "number")
    .map(({ number }) => gh("pr", "view", String(number), "--repo", repo,
      "--json", "number,title,headRefName,state,createdAt,mergedAt,closedAt,body,mergeCommit,comments,commits,files"));
  const branches = gh("api", `repos/${repo}/branches?per_page=100`, "--paginate", "--jq", "[.[].name]");
  const mainCommits = gh("api", `repos/${repo}/commits?sha=main&per_page=100`, "--paginate", "--jq", "[.[] | {oid: .sha, message: .commit.message}]");
  const images = {};
  for (const url of prs.flatMap((p) => imageLinks(p.body))) images[url] = imageExists(repo, url);
  return { repo, fetchedAt: new Date().toISOString(), issues, prs, branches, mainCommits, images, local: scanLocal(root) };
}
