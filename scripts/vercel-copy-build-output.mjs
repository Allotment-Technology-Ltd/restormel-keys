/**
 * Copies apps/dashboard/.vercel/output to repo root .vercel/output so that
 * Vercel (with Root Directory = repo root) finds the Build Output API output.
 * Repo root is resolved from this script's path so it works when run from
 * apps/dashboard or from repo root.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const src = path.join(repoRoot, "apps/dashboard/.vercel/output");
const dest = path.join(repoRoot, ".vercel/output");

if (!fs.existsSync(src)) {
  console.error(`[vercel-copy-build-output] Source not found: ${src}`);
  process.exit(1);
}

fs.cpSync(src, dest, { recursive: true });
console.log(`[vercel-copy-build-output] Copied ${src} -> ${dest}`);
