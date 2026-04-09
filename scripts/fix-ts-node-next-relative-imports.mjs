#!/usr/bin/env node
/**
 * Append .js to relative import/export specifiers for NodeNext tsc emit (packages that use extensionless ./ imports).
 * Usage: node scripts/fix-ts-node-next-relative-imports.mjs <dir> [<dir> ...]
 */
import fs from "node:fs";
import path from "node:path";

function walkTs(dir, acc) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTs(p, acc);
    else if (ent.name.endsWith(".ts")) acc.push(p);
  }
}

function fixFile(file) {
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  // from './x' / from "./x" / export ... from './x' — skip if already .js or not relative
  s = s.replace(/\bfrom\s+(['"])(\.\.?\/[^'"]+?)\1/g, (m, q, spec) => {
    if (spec.endsWith(".js") || spec.includes("*")) return m;
    return `from ${q}${spec}.js${q}`;
  });
  s = s.replace(/\bexport\s+\*\s+from\s+(['"])(\.\.?\/[^'"]+?)\1/g, (m, q, spec) => {
    if (spec.endsWith(".js")) return m;
    return `export * from ${q}${spec}.js${q}`;
  });
  if (s !== orig) fs.writeFileSync(file, s);
}

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error("Usage: fix-ts-node-next-relative-imports.mjs <dir> ...");
  process.exit(1);
}
for (const d of dirs) {
  const abs = path.resolve(d);
  const files = [];
  walkTs(abs, files);
  for (const f of files) fixFile(f);
  console.log(`Patched ${files.length} files under ${abs}`);
}
