import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const src = path.join(repoRoot, "apps/dashboard/.vercel/output");
const dest = path.join(repoRoot, ".vercel/output");

if (!fs.existsSync(src)) {
  console.error(`[vercel-copy-build-output] Source not found: ${src}`);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });

console.log(`[vercel-copy-build-output] Copied ${src} -> ${dest}`);

