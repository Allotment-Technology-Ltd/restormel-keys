#!/usr/bin/env node
// open-issues.mjs — open Forgejo issues from a JSON array [{title, body}], skipping titles that
// already have an open issue. Env: FORGEJO_API, FORGEJO_OWNER, FORGEJO_REPO, FORGEJO_TOKEN.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const { FORGEJO_API: api, FORGEJO_OWNER: owner, FORGEJO_REPO: repo, FORGEJO_TOKEN: token } = process.env;
if (!file || !api || !owner || !repo || !token) { console.log('open-issues: missing file/env — skip'); process.exit(0); }

let items = [];
try { items = JSON.parse(readFileSync(file, 'utf8')); } catch { process.exit(0); }
if (!items.length) { console.log('open-issues: nothing to open'); process.exit(0); }

const h = { Authorization: `token ${token}`, 'Content-Type': 'application/json' };
const base = `${api}/repos/${owner}/${repo}`;
const open = await fetch(`${base}/issues?state=open&type=issues&limit=50`, { headers: h })
  .then((r) => (r.ok ? r.json() : [])).catch(() => []);
const seen = new Set((open || []).map((i) => i.title));

let opened = 0;
for (const it of items) {
  if (seen.has(it.title)) continue;
  const r = await fetch(`${base}/issues`, { method: 'POST', headers: h, body: JSON.stringify({ title: it.title, body: it.body }) }).catch(() => null);
  if (r && r.ok) opened++;
}
console.log(`open-issues: opened ${opened} of ${items.length}`);
