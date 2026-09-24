/**
 * Copies the article markdown from personal-site-2 into content/articles/ so
 * this repo builds standalone in CI (GitHub Actions checks out only this repo).
 *
 * Run locally after publishing new writing:  node scripts/vendor-content.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.resolve(ROOT, "../personal-site-2/src/content/articles");
const DEST = path.join(ROOT, "content/articles");

if (!fs.existsSync(SRC)) {
  console.error(`source not found: ${SRC}`);
  process.exit(1);
}

fs.mkdirSync(DEST, { recursive: true });

const existing = new Set(fs.readdirSync(DEST).filter((f) => f.endsWith(".md")));
const incoming = fs.readdirSync(SRC).filter((f) => f.endsWith(".md"));

let written = 0;
for (const f of incoming) {
  fs.copyFileSync(path.join(SRC, f), path.join(DEST, f));
  existing.delete(f);
  written++;
}

// Drop articles that no longer exist upstream.
let removed = 0;
for (const stale of existing) {
  fs.unlinkSync(path.join(DEST, stale));
  removed++;
}

console.log(`vendored ${written} articles into content/articles${removed ? ` (removed ${removed} stale)` : ""}`);
