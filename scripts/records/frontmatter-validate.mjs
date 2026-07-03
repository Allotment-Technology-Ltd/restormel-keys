#!/usr/bin/env node
// frontmatter-validate.mjs — check records' front-matter against SCHEMA.md.
// Tier >= 2: missing owner/retention is ALWAYS a hard error under RECORDS_ENFORCE=1; the
// approval fields (approved-by/approved-on) are hard ONLY once the record is FINALIZED
// (status approved|deprecated|superseded|closed) — a draft/open record has not been signed
// off yet, so it cannot carry an approver/date (it stays a warning until finalized).
// Vocabulary and tier-range issues are always warnings.
import { readFileSync } from 'node:fs';
import { ROOT, recordFiles, relPosix, parseFrontMatter, warn, note, ENFORCE } from './lib.mjs';

const VOCAB = {
  class: ['technical', 'decision', 'planning', 'governance', 'evidence', 'legal', 'people'],
  status: ['draft', 'approved', 'deprecated', 'superseded'],
  classification: ['public', 'internal', 'confidential', 'restricted'],
};
const TIERS = ['0', '1', '2', '3'];

let errors = 0, warnings = 0;
const hard = (m) => { if (ENFORCE) { console.log(`::error::${m}`); errors++; } else { warn(m); warnings++; } };
const soft = (m) => { warn(m); warnings++; };

for (const fp of recordFiles()) {
  const rel = relPosix(fp);
  const fm = parseFrontMatter(readFileSync(fp, 'utf8'));
  if (!fm) { soft(`${rel}: no front-matter (not yet a managed record)`); continue; }

  for (const [k, allowed] of Object.entries(VOCAB)) {
    if (fm[k] && !allowed.includes(fm[k])) soft(`${rel}: ${k}="${fm[k]}" not in {${allowed.join('|')}}`);
  }
  const tier = String(fm['control-tier'] ?? '');
  if (tier !== '' && !TIERS.includes(tier)) soft(`${rel}: control-tier="${tier}" not 0..3`);
  if (!fm.id) soft(`${rel}: missing id`);

  if (tier === '2' || tier === '3') {
    // owner + retention are required for every governed record regardless of lifecycle state.
    for (const req of ['owner', 'retention']) {
      if (!fm[req]) hard(`${rel}: control-tier ${tier} requires '${req}'`);
    }
    // Approval fields are required once a record is FINALIZED. A draft/open record has not been
    // signed off, so it has no approver yet — flag softly (will become hard the moment it finalizes).
    const FINALIZED = ['approved', 'deprecated', 'superseded', 'closed'];
    const status = String(fm['status'] ?? '');
    const finalized = FINALIZED.includes(status);
    for (const req of ['approved-by', 'approved-on']) {
      if (!fm[req]) {
        if (finalized) hard(`${rel}: control-tier ${tier} (status ${status}) requires '${req}'`);
        else soft(`${rel}: control-tier ${tier} (${status || 'no status'}) — '${req}' required once finalized`);
      }
    }
  } else {
    for (const opt of ['owner', 'retention']) {
      if (!fm[opt]) soft(`${rel}: control-tier ${tier || '?'} missing optional '${opt}'`);
    }
  }
}

note(`frontmatter-validate: ${errors} error(s), ${warnings} warning(s)${ENFORCE ? '' : ' [warn-only]'}`);
process.exit(ENFORCE && errors > 0 ? 1 : 0);
