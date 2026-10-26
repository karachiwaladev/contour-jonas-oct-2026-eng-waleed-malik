// Test helper: a fake browser page (jsdom) wired into Node's globals, so render.js/app.js run
// unmodified. Not a test file itself (doesn't match *.test.mjs).
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

export function setupDom({ withPage = false } = {}) {
  const html = withPage
    ? readFileSync(new URL("./index.html", import.meta.url), "utf8").replace(/<script[^>]*><\/script>/, "")
    : "<!doctype html><html><body></body></html>";
  const dom = new JSDOM(html, { url: "http://localhost/" });
  for (const key of ["window", "document", "localStorage", "Event", "HTMLElement", "Node"]) {
    globalThis[key] = key === "window" ? dom.window : dom.window[key];
  }
  return dom;
}

// Render is async (IndexedDB); poll until the page reaches the expected state.
export async function waitFor(check, { timeout = 2000 } = {}) {
  const start = Date.now();
  for (;;) {
    try { const v = check(); if (v) return v; } catch {}
    if (Date.now() - start > timeout) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}
