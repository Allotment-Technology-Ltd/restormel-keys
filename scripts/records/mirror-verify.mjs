#!/usr/bin/env node
// mirror-verify.mjs — assert the GitHub mirror's main hasn't diverged from Forgejo's main
// (Phase 2, warn-only). The real guarantee is branch protection on the mirror; this is the
// assertion that it holds. Best-effort: skips gracefully if it can't resolve either side.
//
// Mirror URL resolution: $MIRROR_URL, else a `github` remote, else skip. Forgejo side uses
// the `origin` remote (falls back to the local origin/main ref if the remote is unreachable).
import { execFileSync } from 'node:child_process';
import { warn, note, ENFORCE } from './lib.mjs';

const sh = (args) => { try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); } catch { return ''; } };
const sha = (s) => (s || '').split(/\s+/)[0];

const forgejoMain = sha(sh(['ls-remote', 'origin', 'refs/heads/main'])) || sh(['rev-parse', 'origin/main']) || sh(['rev-parse', 'HEAD']);

let mirrorUrl = process.env.MIRROR_URL || '';
if (!mirrorUrl) {
  const ghLine = sh(['remote', '-v']).split('\n').find((l) => /github\.com/i.test(l));
  if (ghLine) mirrorUrl = ghLine.split(/\s+/)[1];
}
if (!mirrorUrl) { note('mirror-verify: no mirror configured (set MIRROR_URL or a github remote) — skip.'); process.exit(0); }

const mirrorMain = sha(sh(['ls-remote', mirrorUrl, 'refs/heads/main']));
if (!mirrorMain) { warn('mirror-verify: could not read mirror main (network/auth) — skip.'); process.exit(0); }
if (!forgejoMain) { warn('mirror-verify: could not resolve Forgejo main — skip.'); process.exit(0); }

if (mirrorMain !== forgejoMain) {
  const m = `mirror main ${mirrorMain.slice(0, 8)} != Forgejo main ${forgejoMain.slice(0, 8)} — mirror diverged (direct write?) or mirror lag`;
  if (ENFORCE) { console.log(`::error::${m}`); process.exit(1); }
  warn(m);
} else {
  note('mirror-verify: mirror main matches Forgejo main.');
}
process.exit(0);
