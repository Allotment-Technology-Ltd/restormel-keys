#!/usr/bin/env node
// freshness-check.mjs — compute next-review and flag stale records (Phase 2, warn-only).
// Warns at T-30 days. Tier >= 2 overdue is an ERROR when RECORDS_ENFORCE=1 (warning until Phase 4).
import { readFileSync } from 'node:fs';
import { recordFiles, relPosix, parseFrontMatter, addISODuration, daysUntil, warn, note, ENFORCE } from './lib.mjs';

let errors = 0, warnings = 0;

for (const fp of recordFiles()) {
  const rel = relPosix(fp);
  const fm = parseFrontMatter(readFileSync(fp, 'utf8'));
  if (!fm || !fm['last-reviewed'] || !fm['review-interval']) continue;
  const next = addISODuration(fm['last-reviewed'], fm['review-interval']);
  if (!next) continue;
  const d = daysUntil(next);
  const tier = String(fm['control-tier'] ?? '');
  if (d < 0) {
    const m = `${rel}: review OVERDUE since ${next} (${-d}d)`;
    if (ENFORCE && (tier === '2' || tier === '3')) { console.log(`::error::${m}`); errors++; }
    else { warn(m); warnings++; }
  } else if (d <= 30) {
    warn(`${rel}: review due in ${d}d (${next})`); warnings++;
  }
}

note(`freshness-check: ${errors} error(s), ${warnings} warning(s)${ENFORCE ? '' : ' [warn-only]'}`);
process.exit(ENFORCE && errors > 0 ? 1 : 0);
