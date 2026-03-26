#!/usr/bin/env node
/**
 * Dogfood CI agent: fetch a GitHub issue, call an LLM for file edits, commit, push, open draft PR.
 * Intended for GitHub Actions; runnable locally with env vars (no extra npm deps; Node 18+).
 *
 * Required env:
 *   GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), DOGFOOD_ISSUE_NUMBER
 *   ANTHROPIC_API_KEY or OPENAI_API_KEY (or DOGFOOD_AGENT_PROVIDER + matching key)
 *
 * Optional:
 *   DOGFOOD_AGENT_PROVIDER=anthropic|openai (default: anthropic if ANTHROPIC_API_KEY set, else openai)
 *   DOGFOOD_DRY_RUN=1 — no git push / no PR; prints summary
 *   DOGFOOD_ANTHROPIC_MODEL, DOGFOOD_OPENAI_MODEL
 *   GITHUB_OUTPUT — set by Actions for step outputs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MAX_ISSUE_CHARS = 14_000;
const MAX_FILES = 20;
const MAX_FILE_BYTES = 120_000;
const ALLOWED_ROOTS = new Set(['docs', 'apps', 'packages', 'scripts', 'prompts', 'e2e']);
const SELF_PATH = 'scripts/dogfood-agent-open-pr.mjs';

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) die(`Missing required env: ${name}`);
  return v;
}

function setOutput(name, value) {
  const p = process.env.GITHUB_OUTPUT;
  if (!p) return;
  const safe = String(value).replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  fs.appendFileSync(p, `${name}=${safe}\n`);
}

function redactIssueText(text) {
  if (!text) return '';
  let t = text;
  const patterns = [
    [/sk_live_[0-9a-zA-Z]{20,}/g, '[REDACTED]'],
    [/sk_test_[0-9a-zA-Z]{20,}/g, '[REDACTED]'],
    [/AKIA[0-9A-Z]{16}/g, '[REDACTED]'],
    [/rk_live_[0-9a-zA-Z_\-]{16,}/g, '[REDACTED]'],
    [/rk_test_[0-9a-zA-Z_\-]{16,}/g, '[REDACTED]'],
    [/ghp_[0-9a-zA-Z]{20,}/g, '[REDACTED]'],
    [/github_pat_[0-9a-zA-Z_]{20,}/gi, '[REDACTED]'],
  ];
  for (const [re, rep] of patterns) t = t.replace(re, rep);
  return t.length > MAX_ISSUE_CHARS ? `${t.slice(0, MAX_ISSUE_CHARS)}\n\n[truncated]` : t;
}

function isAllowedRel(p) {
  const norm = path.normalize(p).replace(/\\/g, '/');
  if (!norm || norm.startsWith('../') || norm.includes('/../') || path.isAbsolute(norm)) return false;
  if (norm === SELF_PATH || norm.startsWith(`${SELF_PATH}/`)) return false;
  const seg = norm.split('/').filter(Boolean);
  if (seg.length === 0) return false;
  const root = seg[0];
  if (!ALLOWED_ROOTS.has(root)) return false;
  if (root === 'scripts' && seg[1] === 'dogfood-agent-open-pr.mjs') return false;
  if (seg[0] === '.github' || seg.includes('.git')) return false;
  if (seg.some((s) => s === '.env' || s.startsWith('.env.'))) return false;
  return true;
}

function extractJsonObject(text) {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = fence ? fence[1].trim() : t;
  const start = inner.indexOf('{');
  if (start === -1) throw new Error('No JSON object in model output');
  let depth = 0;
  let end = -1;
  for (let i = start; i < inner.length; i += 1) {
    const c = inner[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error('Unbalanced JSON braces in model output');
  return JSON.parse(inner.slice(start, end + 1));
}

async function githubJson(method, pathname, body) {
  const token = requireEnv('GITHUB_TOKEN');
  const res = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'restormel-keys-dogfood-agent',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) {
    if (res.status === 404 && method === 'GET') {
      const m = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)$/);
      if (m) {
        const [, o, r, n] = m;
        die(
          [
            `GitHub API GET ${pathname}: 404 — no issue #${n} in ${o}/${r} (or token cannot see it).`,
            '',
            'Use the **[Dogfood] issue number on restormel-keys**, not the consumer (e.g. SOPHIA) source issue number.',
            'Open the relayed ticket in this repo and copy N from: github.com/' + o + '/' + r + '/issues/<N>',
          ].join('\n'),
        );
      }
    }
    die(`GitHub API ${method} ${pathname}: ${res.status} ${txt.slice(0, 500)}`);
  }
  return txt ? JSON.parse(txt) : null;
}

async function callAnthropic(system, user) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) die('ANTHROPIC_API_KEY not set');
  const model = process.env.DOGFOOD_ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const txt = await res.text();
  if (!res.ok) die(`Anthropic API error ${res.status}: ${txt.slice(0, 800)}`);
  const data = JSON.parse(txt);
  const block = (data.content || []).find((b) => b.type === 'text');
  return block?.text || '';
}

async function callOpenAI(system, user) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) die('OPENAI_API_KEY not set');
  const model = process.env.DOGFOOD_OPENAI_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
    }),
  });
  const txt = await res.text();
  if (!res.ok) die(`OpenAI API error ${res.status}: ${txt.slice(0, 800)}`);
  const data = JSON.parse(txt);
  return data.choices?.[0]?.message?.content || '';
}

function git(args, opts = {}) {
  execFileSync('git', args, { stdio: opts.stdio || 'pipe', encoding: 'utf8' });
}

function gitOut(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

async function run() {
  const repo = requireEnv('GITHUB_REPOSITORY');
  const issueNumber = String(requireEnv('DOGFOOD_ISSUE_NUMBER')).replace(/\D/g, '');
  if (!issueNumber) die('Invalid DOGFOOD_ISSUE_NUMBER');
  const dry = process.env.DOGFOOD_DRY_RUN === '1' || process.env.DOGFOOD_DRY_RUN === 'true';

  let provider = process.env.DOGFOOD_AGENT_PROVIDER;
  if (!provider) {
    if (process.env.ANTHROPIC_API_KEY) provider = 'anthropic';
    else if (process.env.OPENAI_API_KEY) provider = 'openai';
    else die('Set ANTHROPIC_API_KEY or OPENAI_API_KEY (or DOGFOOD_AGENT_PROVIDER with a matching key).');
  }

  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) die(`Invalid GITHUB_REPOSITORY: ${repo}`);

  const issue = await githubJson('GET', `/repos/${owner}/${repoName}/issues/${issueNumber}`, undefined);
  if (issue.pull_request != null) die('Target is a pull request, not an issue.');

  const title = issue.title || '';
  const body = redactIssueText(issue.body || '');

  const system = [
    'You are a coding agent for the restormel-keys monorepo.',
    'Respond with ONE JSON object only (no markdown fences). Shape:',
    '{"summary":"one line","files":[{"path":"relative/path","content":"full UTF-8 file contents"}]}',
    'Rules:',
    '- Minimal, targeted changes only; no unrelated refactors.',
    '- Respect repository phase/bootstrap constraints (no large new product surfaces unless the issue clearly requires them).',
    '- Prefer docs and small fixes when the issue is documentation or guidance; change apps/ or packages/ only when the issue clearly requires product code.',
    '- Paths must be repo-relative and under these roots only: docs/, apps/, packages/, scripts/, prompts/, e2e/.',
    '- Never touch .github/, never add .env files, never modify scripts/dogfood-agent-open-pr.mjs.',
    '- Provide full file contents for each file (not diffs).',
    '- If the issue is ambiguous, unsafe, or needs a human decision, return {"summary":"...","files":[]} with explanation in summary.',
  ].join('\n');

  const user = [`GitHub issue #${issueNumber}`, `Title: ${title}`, '', 'Body (may be redacted):', body].join('\n');

  let rawOut;
  if (provider === 'anthropic') rawOut = await callAnthropic(system, user);
  else if (provider === 'openai') rawOut = await callOpenAI(system, user);
  else die(`Unknown DOGFOOD_AGENT_PROVIDER: ${provider}`);

  let parsed;
  try {
    parsed = extractJsonObject(rawOut);
  } catch (e) {
    die(`Failed to parse model JSON: ${e.message}\n---\n${rawOut.slice(0, 2000)}`);
  }

  const summary = String(parsed.summary || '').trim() || '(no summary)';
  const files = Array.isArray(parsed.files) ? parsed.files : [];

  console.log(`Model summary: ${summary}`);
  console.log(`Files proposed: ${files.length}`);

  if (files.length === 0) {
    setOutput('noop', 'true');
    setOutput('dry_run', 'false');
    setOutput('summary', summary);
    console.log('No file changes; exiting 0 (noop).');
    return;
  }

  if (files.length > MAX_FILES) die(`Too many files (${files.length} > ${MAX_FILES})`);

  const writes = [];
  for (const f of files) {
    const rel = String(f.path || '').trim();
    const content = f.content == null ? '' : String(f.content);
    if (!isAllowedRel(rel)) die(`Disallowed path: ${rel}`);
    const buf = Buffer.from(content, 'utf8');
    if (buf.length > MAX_FILE_BYTES) die(`File too large: ${rel}`);
    writes.push({ rel, content });
  }

  // Prefer Actions env (avoids `git symbolic-ref origin/HEAD` noise/failure in shallow checkouts).
  let baseBranch = 'main';
  const refName = process.env.GITHUB_REF_NAME;
  if (refName && /^[\w./-]+$/.test(refName) && !refName.includes('..')) {
    baseBranch = refName;
  } else {
    try {
      const sym = gitOut(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      baseBranch = sym.replace('refs/remotes/origin/', '') || 'main';
    } catch {
      baseBranch = 'main';
    }
  }

  const shortSha = gitOut(['rev-parse', '--short', 'HEAD']).replace(/[^a-f0-9]/g, '').slice(0, 7) || 'local';
  // Unique per run: same issue + base SHA reused a fixed branch name and hit non-fast-forward on retry.
  const runSuffix = (process.env.GITHUB_RUN_ID && String(process.env.GITHUB_RUN_ID).replace(/\D/g, '')) || `local-${Date.now()}`;
  const branch = `dogfood/agent-issue-${issueNumber}-${shortSha}-${runSuffix}`;

  if (dry) {
    console.log(`[dry-run] Would create branch ${branch} and write:`);
    for (const w of writes) console.log(`  - ${w.rel} (${Buffer.byteLength(w.content, 'utf8')} bytes)`);
    setOutput('dry_run', 'true');
    setOutput('noop', 'false');
    setOutput('branch', branch);
    return;
  }

  git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  git(['config', 'user.name', 'github-actions[bot]']);

  git(['checkout', '-b', branch]);

  const root = process.cwd();
  for (const w of writes) {
    const abs = path.join(root, w.rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, w.content, 'utf8');
  }

  const addPaths = writes.map((w) => w.rel);
  git(['add', '--', ...addPaths]);

  const commitMsg = `dogfood(agent): address #${issueNumber}\n\n${summary}\n`;
  git(['commit', '-m', commitMsg]);

  git(['push', 'origin', `HEAD:${branch}`]);

  const prBody = [
    '**Automated draft PR** from `scripts/dogfood-agent-open-pr.mjs` (GitHub Actions).',
    '',
    'Human review required before merge: verify behaviour, security (no secrets), CI, and scope.',
    '',
    `Fixes #${issueNumber}`,
    '',
    `**Agent summary:** ${summary}`,
  ].join('\n');

  const pr = await githubJson('POST', `/repos/${owner}/${repoName}/pulls`, {
    title: `[Dogfood][agent] ${title}`.slice(0, 240),
    head: branch,
    base: baseBranch,
    body: prBody,
    draft: true,
  });

  const prUrl = pr.html_url || '';
  const prNum = pr.number != null ? String(pr.number) : '';
  console.log(`Opened draft PR: ${prUrl}`);
  setOutput('pr_url', prUrl);
  setOutput('pr_number', prNum);
  setOutput('branch', branch);
  setOutput('noop', 'false');
  setOutput('dry_run', 'false');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
