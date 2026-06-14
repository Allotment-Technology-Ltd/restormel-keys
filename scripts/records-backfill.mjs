#!/usr/bin/env node
/**
 * records-backfill.mjs — Phase 1 (part 2) of the Records & IA plan.
 *
 * Adds the records front-matter convention (records/SCHEMA.md) to existing
 * Markdown under /docs. Purely additive and IDEMPOTENT: files that already
 * have front-matter are skipped, so re-running changes nothing.
 *
 * Dates come from git history:
 *   last-reviewed = the file's last commit date
 *   created       = the file's first (add) commit date
 *
 * Run from the repo root:
 *   node scripts/records-backfill.mjs --dry-run   # preview, writes nothing
 *   node scripts/records-backfill.mjs             # apply
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative, sep, basename } from 'node:path';

const ROOT = process.cwd();
const DOCS = join(ROOT, 'docs');
const DRY = process.argv.includes('--dry-run');

const DEFAULTS = {
  owner: 'founder',
  status: 'approved',
  classification: 'internal',
  controlTier: 1,
  reviewInterval: 'P12M',
};

function git(args) {
  try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
  catch { return ''; }
}

function firstLastDates(relPath) {
  const last = git(['log', '-1', '--format=%cI', '--', relPath]).slice(0, 10);
  const adds = git(['log', '--diff-filter=A', '--format=%cI', '--', relPath])
    .split('\n').filter(Boolean);
  const first = (adds.length ? adds[adds.length - 1] : '').slice(0, 10);
  return { first, last };
}

function classFor(relPath) {
  if (relPath.startsWith(`docs${sep}decisions${sep}`)) return 'decision';
  if (relPath.startsWith(`docs${sep}governance${sep}`)) return 'governance';
  return 'technical'; // plan default
}

function titleFor(content, fp) {
  const m = content.match(/^#\s+(.+?)\s*$/m);
  if (m) return m[1].replace(/[`"]/g, '').trim();
  return basename(fp, '.md').replace(/[-_]/g, ' ');
}

const hasFrontMatter = (c) => /^---\r?\n/.test(c);

function walk(dir, acc = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const fp = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'archive') continue; // superseded — don't stamp as approved
      walk(fp, acc);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      acc.push(fp);
    }
  }
  return acc;
}

const files = walk(DOCS);
let stamped = 0, skipped = 0;
const byClass = {};

for (const fp of files) {
  const rel = relative(ROOT, fp);
  const content = readFileSync(fp, 'utf8');
  if (hasFrontMatter(content)) { skipped++; continue; }

  const { first, last } = firstLastDates(rel);
  const today = new Date().toISOString().slice(0, 10);
  const lastReviewed = last || today;
  const created = first || lastReviewed;
  const cls = classFor(rel);

  const fm = [
    '---',
    `title: ${titleFor(content, fp)}`,
    `class: ${cls}`,
    `owner: ${DEFAULTS.owner}`,
    `status: ${DEFAULTS.status}`,
    `classification: ${DEFAULTS.classification}`,
    `control-tier: ${DEFAULTS.controlTier}`,
    `created: ${created}`,
    `last-reviewed: ${lastReviewed}`,
    `review-interval: ${DEFAULTS.reviewInterval}`,
    '---', '', '',
  ].join('\n');

  if (!DRY) writeFileSync(fp, fm + content);
  stamped++;
  byClass[cls] = (byClass[cls] || 0) + 1;
}

console.log(`records-backfill${DRY ? ' [dry-run]' : ''}: ${stamped} stamped, ` +
  `${skipped} already had front-matter, ${files.length} docs scanned.`);
console.log('  by class:', JSON.stringify(byClass));
