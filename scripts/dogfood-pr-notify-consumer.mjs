#!/usr/bin/env node
/**
 * Comment on the consumer (e.g. SOPHIA) issue linked from a relayed [Dogfood] restormel-keys issue
 * when a PR is opened or merged to main. Uses the same PAT convention as dogfood-upstream-notify-consumer.
 *
 * Usage: node scripts/dogfood-pr-notify-consumer.mjs <opened|merged>
 *
 * Env:
 *   GITHUB_REPOSITORY — owner/repo (restormel-keys)
 *   GITHUB_TOKEN — default Actions token (read issues on this repo)
 *   CONSUMER_PAT — DOGFOOD_NOTIFY_CONSUMER_TOKEN or RESTORMEL_KEYS_ISSUE_TOKEN (issues:write on consumer)
 *   DOGFOOD_NOTIFY_CONSUMER — optional Owner/consumer-repo; if set, consumer issue must match (case-insensitive)
 *   PR_BODY, PR_HTML_URL, PR_TITLE, PR_NUMBER
 *   MERGE_COMMIT_SHA — required when kind is merged
 */
import process from 'node:process';

const SOURCE_LINK_RE = /\[View source issue\]\((https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+))\)/i;
const FIXES_RE = /\b(?:fixes|closes|addresses)\s+#(\d+)\b/gi;

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
      'User-Agent': 'restormel-keys-dogfood-pr-notify',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${txt.slice(0, 400)}`);
  return txt ? JSON.parse(txt) : null;
}

function parseConsumerRef(issueBody) {
  const m = issueBody.match(SOURCE_LINK_RE);
  if (!m) return null;
  const [, , owner, repo, num] = m;
  return { owner, repo, issueNumber: parseInt(num, 10), url: m[1] };
}

function collectUpstreamIssueNumbers(prBody) {
  if (!prBody) return [];
  const seen = new Set();
  const out = [];
  for (const m of prBody.matchAll(FIXES_RE)) {
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function consumerMatchesExpected(owner, repo) {
  const expected = process.env.DOGFOOD_NOTIFY_CONSUMER?.trim();
  if (!expected) return true;
  const norm = (s) => s.toLowerCase().replace(/\s+/g, '');
  return norm(`${owner}/${repo}`) === norm(expected);
}

async function main() {
  const kind = process.argv[2];
  if (kind !== 'opened' && kind !== 'merged') die('Usage: dogfood-pr-notify-consumer.mjs <opened|merged>');

  const repoFull = process.env.GITHUB_REPOSITORY || die('Missing GITHUB_REPOSITORY');
  const [keysOwner, keysRepo] = repoFull.split('/');
  const githubToken = process.env.GITHUB_TOKEN || die('Missing GITHUB_TOKEN');
  const consumerPat = process.env.CONSUMER_PAT || die('Missing CONSUMER_PAT');
  const prBody = process.env.PR_BODY || '';
  const prUrl = process.env.PR_HTML_URL || '';
  const prTitle = process.env.PR_TITLE || '';
  const prNumber = process.env.PR_NUMBER || '';

  if (kind === 'merged') {
    if (!process.env.MERGE_COMMIT_SHA) die('Missing MERGE_COMMIT_SHA for merged');
  }

  const issueNums = collectUpstreamIssueNumbers(prBody);
  if (issueNums.length === 0) {
    console.log('No Fixes/Closes/Addresses #N in PR body; skipping consumer notify.');
    process.exit(0);
  }

  const base = 'https://api.github.com';
  const commented = [];

  for (const num of issueNums) {
    let issue;
    try {
      issue = await githubJson(
        'GET',
        `${base}/repos/${keysOwner}/${keysRepo}/issues/${num}`,
        githubToken,
        undefined
      );
    } catch (e) {
      console.warn(`Skip #${num}: ${e.message}`);
      continue;
    }
    if (issue.pull_request) continue;
    const title = issue.title || '';
    if (!/\[dogfood\]/i.test(title)) {
      console.log(`Skip #${num}: title does not look like [Dogfood]`);
      continue;
    }
    const ref = parseConsumerRef(issue.body || '');
    if (!ref) {
      console.log(`Skip #${num}: no [View source issue](...) link in body`);
      continue;
    }
    if (!consumerMatchesExpected(ref.owner, ref.repo)) {
      console.warn(
        `Skip #${num}: consumer ${ref.owner}/${ref.repo} does not match DOGFOOD_NOTIFY_CONSUMER=${process.env.DOGFOOD_NOTIFY_CONSUMER || '(unset)'}`,
      );
      continue;
    }

    const keysIssueUrl = issue.html_url;
    const mergeSha = process.env.MERGE_COMMIT_SHA || '';
    const mergeUrl =
      mergeSha && keysOwner && keysRepo
        ? `https://github.com/${keysOwner}/${keysRepo}/commit/${mergeSha}`
        : '';
    const changelogUrl = `https://github.com/${keysOwner}/${keysRepo}/blob/main/CHANGELOG.md`;

    let body;
    if (kind === 'opened') {
      body = [
        '### Restormel Keys — pull request opened',
        '',
        `A PR is open on **${keysOwner}/${keysRepo}** that references upstream issue **#${num}** (${keysIssueUrl}).`,
        '',
        `- **PR:** ${prUrl}`,
        `- **Title:** ${prTitle}`,
        `- **PR #:** ${prNumber}`,
        '',
        '_Automated comment from restormel-keys Actions. No secrets in this message._',
      ].join('\n');
    } else {
      body = [
        '### Restormel Keys — merged to `main`',
        '',
        `Work linked to upstream issue **#${num}** (${keysIssueUrl}) has been **merged into \`main\`**.`,
        '',
        `- **PR:** ${prUrl}`,
        `- **Title:** ${prTitle}`,
        mergeUrl ? `- **Merge commit:** ${mergeUrl}` : '',
        `- **Release notes:** See [CHANGELOG.md](${changelogUrl}) on **restormel-keys**. Published npm packages align with **keys-v** version tags on this repo when maintainers run the release train.`,
        '',
        '_Automated comment from restormel-keys Actions. Verify CHANGELOG / deploy for your environment._',
      ]
        .filter(Boolean)
        .join('\n');
    }

    await githubJson(
      'POST',
      `${base}/repos/${ref.owner}/${ref.repo}/issues/${ref.issueNumber}/comments`,
      consumerPat,
      { body }
    );
    commented.push(`${ref.owner}/${ref.repo}#${ref.issueNumber}`);
  }

  if (commented.length === 0) {
    console.log('No consumer issues notified.');
  } else {
    console.log(`Posted to: ${commented.join(', ')}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
