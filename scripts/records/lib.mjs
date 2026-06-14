// lib.mjs — shared helpers for the records governance scripts (Phase 2).
// Dependency-free (Node built-ins only) so it runs with plain `node` on the docker runner.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

export const ROOT = process.cwd();
export const ENFORCE = process.env.RECORDS_ENFORCE === '1';

// Record-bearing roots. Some may not exist yet (greenfield in Phase 4) — skipped if absent.
export const RECORD_ROOTS = ['docs', 'records', 'governance', 'evidence', 'planning', 'legal', 'people'];

export const warn = (m) => console.log(`::warning::${m}`);
export const note = (m) => console.log(m);

export function walkMd(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const fp = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'archive' || e.name === 'node_modules') continue;
      walkMd(fp, acc);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      acc.push(fp);
    }
  }
  return acc;
}

export function recordFiles() {
  const out = [];
  for (const r of RECORD_ROOTS) walkMd(join(ROOT, r), out);
  return out.sort();
}

export const relPosix = (fp) => relative(ROOT, fp).split('\\').join('/');

// Minimal YAML front-matter reader for flat key: value (+ inline [a, b] lists).
export function parseFrontMatter(content) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (/^\[.*\]$/.test(val)) val = val.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    else val = val.replace(/^["']|["']$/g, '');
    data[key] = val;
  }
  return data;
}

export function gitShow(ref) {
  try { return execFileSync('git', ['show', ref], { encoding: 'utf8' }); }
  catch { return null; }
}

// Add an ISO-8601 duration (e.g. P12M, P3Y, P30D) to a YYYY-MM-DD date.
export function addISODuration(dateStr, dur) {
  if (!dateStr || !dur) return null;
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(dur);
  if (!m) return null;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCFullYear(d.getUTCFullYear() + (+m[1] || 0));
  d.setUTCMonth(d.getUTCMonth() + (+m[2] || 0));
  d.setUTCDate(d.getUTCDate() + (+m[3] || 0) * 7 + (+m[4] || 0));
  return d.toISOString().slice(0, 10);
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const t = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86400000);
}
