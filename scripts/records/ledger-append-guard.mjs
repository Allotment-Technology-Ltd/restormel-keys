#!/usr/bin/env node
// ledger-append-guard.mjs — enforce that evidence/ledger.jsonl is append-only (Phase 2, warn-only).
// Compares against the committed version (HEAD): any prior line changed or removed is tampering.
// New lines appended at the end are fine. Needs git history (checkout fetch-depth: 0).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, gitShow, warn, note, ENFORCE } from './lib.mjs';

const REL = 'evidence/ledger.jsonl';
const abs = join(ROOT, REL);

if (!existsSync(abs)) { note('ledger-append-guard: no ledger yet — skip.'); process.exit(0); }

const cur = readFileSync(abs, 'utf8').split(/\r?\n/);
const prevRaw = gitShow(`HEAD:${REL}`);
let tampered = 0;

if (prevRaw !== null) {
  const prev = prevRaw.split(/\r?\n/);
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] === '') continue;
    if (cur[i] !== prev[i]) {
      const m = `ledger line ${i + 1} changed or removed — evidence ledger is append-only`;
      if (ENFORCE) console.log(`::error::${m}`); else warn(m);
      tampered++;
    }
  }
}

if (!tampered) note('ledger-append-guard: append-only OK.');
process.exit(ENFORCE && tampered > 0 ? 1 : 0);
