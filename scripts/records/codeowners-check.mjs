#!/usr/bin/env node
// codeowners-check.mjs — every tracked record path must be covered by a CODEOWNERS rule (Phase 2).
// Warn-only; ERROR when RECORDS_ENFORCE=1. No orphaned records with no owner.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, recordFiles, relPosix, warn, note, ENFORCE } from './lib.mjs';

const LOCS = ['CODEOWNERS', '.forgejo/CODEOWNERS', '.gitea/CODEOWNERS', 'docs/CODEOWNERS'];
const file = LOCS.map((l) => join(ROOT, l)).find(existsSync);

if (!file) {
  const m = 'no CODEOWNERS file found';
  if (ENFORCE) { console.log(`::error::${m}`); process.exit(1); }
  warn(m); process.exit(0);
}

const patterns = readFileSync(file, 'utf8').split(/\r?\n/)
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split(/\s+/)[0]);

function covered(rel) {
  return patterns.some((pat) => {
    if (pat === '*') return true;
    const p = pat.startsWith('/') ? pat.slice(1) : pat;
    return rel === p || rel.startsWith(p) || rel.includes(p.replace(/\*/g, ''));
  });
}

let uncovered = 0;
for (const fp of recordFiles()) {
  const rel = relPosix(fp);
  if (!covered(rel)) {
    const m = `${rel}: not covered by any CODEOWNERS rule`;
    if (ENFORCE) console.log(`::error::${m}`); else warn(m);
    uncovered++;
  }
}

note(`codeowners-check: ${uncovered} uncovered record path(s)${ENFORCE ? '' : ' [warn-only]'}`);
process.exit(ENFORCE && uncovered > 0 ? 1 : 0);
