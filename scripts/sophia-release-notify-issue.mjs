#!/usr/bin/env node
/**
 * Open a SOPHIA (consumer) backlog issue when restormel-keys ships a release-notify tag.
 * Tags: keys-v* (npm train anchor) or restormel-v* (hosted API/dashboard/docs without npm).
 * Not coupled to npm publish success — same push event as Publish for keys-v*, but this job stands alone.
 *
 * Env:
 *   CONSUMER_PAT — Issues: write on consumer repo
 *   DOGFOOD_NOTIFY_CONSUMER — owner/repo (e.g. Allotment-Technology-Ltd/sophia)
 *   TAG — e.g. keys-v0.2.13 or restormel-v0.1.0
 *   GITHUB_REPOSITORY — upstream owner/repo (restormel-keys)
 *   FORCE — if "true", skip duplicate title check
 *
 * Args:
 *   [path to CHANGELOG.md]  default: ./CHANGELOG.md
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const LABEL = 'restormel-upstream-release';

/** `keys-v*` (npm train) or `restormel-v*` (consumer-visible ref without requiring npm). */
export function isReleaseNotifyTag(tag) {
  return /^(keys-v|restormel-v)[0-9]/i.test(String(tag || '').trim());
}

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

async function githubJson(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'restormel-keys-sophia-release-notify',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${txt.slice(0, 500)}`);
  return txt ? JSON.parse(txt) : null;
}

/** Extract first ## section whose heading starts with ## ${tag} (CHANGELOG uses ## keys-vX (date)). */
export function extractChangelogSection(markdown, tag) {
  if (!markdown || !tag) return '';
  const lines = markdown.split(/\r?\n/);
  const headerRe = new RegExp(`^##\\s+${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (headerRe.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return '';
  const out = [];
  for (let i = start; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

function buildBody({ tag, upstreamOwner, upstreamRepo, changelogExcerpt }) {
  const treeUrl = `https://github.com/${upstreamOwner}/${upstreamRepo}/tree/${tag}`;
  const changelogUrl = `https://github.com/${upstreamOwner}/${upstreamRepo}/blob/${tag}/CHANGELOG.md`;
  const dogfoodIssues = `https://github.com/${upstreamOwner}/${upstreamRepo}/issues?q=is%3Aissue+label%3Atask+%5BDogfood%5D`;
  const openapiUrl = `https://github.com/${upstreamOwner}/${upstreamRepo}/blob/${tag}/docs/api/openapi.yaml`;
  const keysCatalogSync = `https://github.com/${upstreamOwner}/${upstreamRepo}/blob/${tag}/docs/guides/integration/keys-catalog-sync.md`;
  const resolveGuide = `https://github.com/${upstreamOwner}/${upstreamRepo}/blob/${tag}/docs/guides/resolve-to-execution-contract.md`;

  const excerptBlock =
    changelogExcerpt.length > 0
      ? [
          '### Release notes (from CHANGELOG on this tag)',
          '',
          changelogExcerpt.length > 24000
            ? `${changelogExcerpt.slice(0, 24000)}\n\n_(Excerpt truncated for GitHub issue length.)_`
            : changelogExcerpt,
          '',
        ].join('\n')
      : [
          '### Release notes (from CHANGELOG on this tag)',
          '',
          '_No matching `## ' + tag + '` section found in CHANGELOG.md on this ref — use the CHANGELOG link below and compare to the previous **`keys-v*`** or **`restormel-v*`** tag._',
          '',
        ].join('\n');

  const triage = [
    '### SOPHIA backlog — what might need implementation?',
    '',
    'Use this issue to **triage** the release. Not every train requires SOPHIA code changes.',
    '',
    '| Area | When SOPHIA work is likely |',
    '|------|----------------------------|',
    '| **`@restormel/*` npm packages** | When CHANGELOG lists version bumps (common on **`keys-v*`** trains); update pins / lockfile / vendor tarballs in SOPHIA **if** you consume those packages — not every notify tag ships npm. |',
    '| **Dashboard / Gateway API contract** | OpenAPI version, new paths, `contractVersion`, resolve payload, **project model index** (`GET …/models`), or validation errors documented in release notes. |',
    '| **Integrator docs** | Changes under `docs/restormel-integration/`, **Cloud API** matrix, or **resolve** guide — align host parsing / merge layers. |',
    '| **`[Dogfood]` threads** | Items closed in this release — follow linked SOPHIA issues and upstream PRs. |',
    '| **Keys-hosted DB migrations** | If CHANGELOG mentions dashboard migrations, **Keys** operators apply them; SOPHIA only acts if your deployment doc says so. |',
    '',
    '**Often Keys-only (no SOPHIA app change expected)**',
    '- Documentation-only, CI, or Zuplo gateway config in **restormel-keys**.',
    '- Internal dashboard UI unless SOPHIA embeds that surface.',
    '',
    '### Links (this ref)',
    '',
    '| Resource | URL |',
    '|----------|-----|',
    '| Tag tree | ' + treeUrl + ' |',
    '| CHANGELOG | ' + changelogUrl + ' |',
    '| OpenAPI | ' + openapiUrl + ' |',
    '| Project index / catalog (integrators) | ' + keysCatalogSync + ' |',
    '| Resolve → execution contract | ' + resolveGuide + ' |',
    '| Upstream `[Dogfood]` search | ' + dogfoodIssues + ' |',
    '',
    '### Suggested checklist',
    '- [ ] Read **CHANGELOG** section above (or full file at this ref).',
    '- [ ] Review **hosted dashboard**, **gateway/OpenAPI**, and **integrator docs** for behaviour relevant to SOPHIA (independent of npm).',
    '- [ ] If applicable, bump **`@restormel/*`** (typically when this ref is a **`keys-v*`** train with package notes).',
    '- [ ] Skim **OpenAPI** diff vs the previous consumer-notify tag if the API surface may have changed.',
    '- [ ] Close or update **SOPHIA** issues that were waiting on this release.',
    '',
    '_Automated from **restormel-keys** Actions. Do not post API keys, gateway keys, or PATs here._',
  ].join('\n');

  return [
    '## Restormel Keys — release **`' + tag + '`** (SOPHIA backlog / triage)',
    '',
    'This issue was opened automatically when **`' + tag + '`** was pushed on **`' + upstreamOwner + '/' + upstreamRepo + '`**.',
    '',
    '**Scope:** This notification is **not conditional on npm publish**. The **`keys-v*`** tag also starts the [Publish](https://github.com/' +
      upstreamOwner +
      '/' +
      upstreamRepo +
      '/actions/workflows/publish.yml) workflow, but that job can **fail or be irrelevant** to your integration; SOPHIA should still triage **hosted dashboard behaviour**, **Gateway/OpenAPI**, **Zuplo**, and **integrator docs** for this ref. For consumer-visible trains **without** an npm release, maintainers can push a **`restormel-v*`** tag on the desired commit (same automation).',
    '',
    excerptBlock,
    triage,
  ].join('\n');
}

async function main() {
  const changelogPath = process.argv[2] || 'CHANGELOG.md';
  const tag = (process.env.TAG || '').trim();
  const consumer = (process.env.DOGFOOD_NOTIFY_CONSUMER || '').trim();
  const pat = process.env.CONSUMER_PAT || die('Missing CONSUMER_PAT');
  const repoFull = process.env.GITHUB_REPOSITORY || die('Missing GITHUB_REPOSITORY');
  const force = String(process.env.FORCE || '').toLowerCase() === 'true';

  if (!isReleaseNotifyTag(tag)) die(`Invalid TAG: ${tag} (expected keys-v* or restormel-v*)`);
  const slash = consumer.indexOf('/');
  if (slash < 1) die('DOGFOOD_NOTIFY_CONSUMER must be owner/repo');
  const cOwner = consumer.slice(0, slash);
  const cRepo = consumer.slice(slash + 1);

  const [upstreamOwner, upstreamRepo] = repoFull.split('/');
  const base = 'https://api.github.com';

  let changelogMd = '';
  try {
    changelogMd = fs.readFileSync(changelogPath, 'utf8');
  } catch {
    console.warn(`Could not read ${changelogPath}`);
  }
  const excerpt = extractChangelogSection(changelogMd, tag);
  const body = buildBody({ tag, upstreamOwner, upstreamRepo, changelogExcerpt: excerpt });
  const title = `[Restormel Keys] Release ${tag} — SOPHIA backlog / triage`;

  if (!force) {
    const q = `repo:${cOwner}/${cRepo} is:issue in:title ${tag}`;
    const searchUrl = `${base}/search/issues?q=${encodeURIComponent(q)}`;
    const found = await githubJson('GET', searchUrl, pat, undefined);
    if (found.total_count > 0) {
      console.log(`Skip: existing issue mentioning ${tag} (${found.total_count} hit(s)).`);
      process.exit(0);
    }
  }

  try {
    await githubJson('POST', `${base}/repos/${cOwner}/${cRepo}/labels`, pat, {
      name: LABEL,
      color: '1D76DB',
      description: 'Auto-opened when restormel-keys ships keys-v* or restormel-v*',
    });
  } catch (e) {
    if (!String(e.message).includes('422')) console.warn(String(e));
  }

  const created = await githubJson('POST', `${base}/repos/${cOwner}/${cRepo}/issues`, pat, {
    title,
    body,
    labels: [LABEL],
  });
  console.log(`Created: ${created.html_url}`);
}

const __filename = fileURLToPath(import.meta.url);
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (invokedDirectly) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
