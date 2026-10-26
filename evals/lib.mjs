// Shared parsing helpers. Every rule here is a fixed pattern over GitHub/git data - no model calls.

const MARK = /<!--\s*factory-loop:([a-z]+)\s*-->/g;
export const markers = (body = "") => [...body.matchAll(MARK)].map((m) => m[1]);
export const hasMarker = (c, m) => markers(c.body).includes(m);
// The loop and the author share one account, so the hidden marker is the only way to tell them apart.
export const isLoop = (c) => markers(c.body).length > 0;
export const isAuthor = (c) => !isLoop(c);

// Whole comment must be the approval word: "yes, but change X" is feedback, not approval.
const APPROVAL = /^[\s*_]*(approved?|merge|lgtm|ship it|yes|go ahead|👍)[\s*_.!]*$/i;
export const isApproval = (c) => isAuthor(c) && APPROVAL.test(c.body.trim());

export const ticketNo = (title) => { const m = /^Ticket #(\d+)/.exec(title); return m ? Number(m[1]) : null; };
export const closesIssue = (body = "") => { const m = /\bCloses #(\d+)/i.exec(body); return m ? Number(m[1]) : null; };
export const imageLinks = (body = "") => [...body.matchAll(/!\[[^\]]*\]\((https:\/\/github\.com\/[^)\s]+)\)/g)].map((m) => m[1]);

const CODE = /\.(m?js|ts|html|css)$/;
const NOT_PRODUCT = /^(answers|evals|\.claude|\.github)\//;
export const isBuildPr = (pr) => pr.files.some((f) => CODE.test(f.path) && !NOT_PRODUCT.test(f.path));
// Shipped code: not tests, not evals. The task eval must be committed before any of this.
export const isProductFile = (path) =>
  CODE.test(path) && !NOT_PRODUCT.test(path) && !/\.test\.m?js$/.test(path) && !/(^|\/)evals\//.test(path);
export const taskEvalPath = (ticket) => new RegExp(`^[^/]+/evals/ticket-${ticket}\\.test\\.mjs$`);

export const sortByTime = (comments) => [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
export const lastIndex = (arr, pred) => { for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i; return -1; };

// The PR that carries a ticket: closes the issue and comes from a ticket-<n>-* branch.
export const prFor = (snap, issue) => snap.prs.find((p) => closesIssue(p.body) === issue.number && /^ticket-\d+-/.test(p.headRefName));
