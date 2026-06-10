/**
 * Sticky PR comment for the connect-eval gate: ONE comment per PR, found by an invisible
 * HTML marker and updated in place (no comment spam). Body building and comment matching
 * are pure functions; the REST upsert uses plain fetch against the GitHub-compatible
 * issues API (GITHUB_API_URL), which Forgejo also serves, so the same code posts the
 * comment on the Forgejo mirror.
 */

import type { GateVerdict } from "./gate.js";

const MARKER_PREFIX = "<!-- restormel-connect-eval";

/** Marker comment line. The discriminator allows several gates per PR without collisions. */
export function stickyMarker(discriminator?: string): string {
  const d = discriminator?.trim();
  return d ? `${MARKER_PREFIX}:${d} -->` : `${MARKER_PREFIX} -->`;
}

const VERDICT_HEADLINE: Record<GateVerdict, string> = {
  pass: "✅ **Connect eval: PASS**",
  quality_fail: "❌ **Connect eval: FAIL** — graph misses the published G2 bar",
  regression: "⚠️ **Connect eval: REGRESSION** — quality dropped vs the committed baseline",
  config_error: "🛠️ **Connect eval: CONFIG ERROR** — the gate could not evaluate",
  error: "🛠️ **Connect eval: ERROR** — the gate crashed before a verdict",
};

export interface StickyCommentBodyArgs {
  marker: string;
  verdict: GateVerdict;
  /** Markdown emitted by `keys connect eval --output markdown` (diff table when a baseline was given). */
  markdown: string;
  warnOnly: boolean;
  /** Workflow run URL for traceability (server/repo/actions/runs/id). */
  runUrl?: string;
  commitSha?: string;
}

/** Compose the comment body: marker first (matching), then headline, table, footer. */
export function buildStickyCommentBody(args: StickyCommentBodyArgs): string {
  const out: string[] = [args.marker, "", VERDICT_HEADLINE[args.verdict]];
  if (args.warnOnly && (args.verdict === "quality_fail" || args.verdict === "regression")) {
    out.push("", "> Warn mode: this gate is currently **non-blocking** — the check stays green while the team tunes the baseline. See the action README for the blocking flip condition.");
  }
  out.push("", args.markdown.trim(), "");
  const footer: string[] = [];
  if (args.commitSha) footer.push(`commit \`${args.commitSha.slice(0, 12)}\``);
  if (args.runUrl) footer.push(`[workflow run](${args.runUrl})`);
  footer.push("`keys connect eval --baseline` (exit 0 pass / 1 fail / 2 config / 3 regression)");
  out.push(`<sub>${footer.join(" · ")}</sub>`);
  return out.join("\n");
}

export interface IssueCommentRef {
  id: number;
  body?: string | null;
}

/** First comment carrying the marker (update target), or null to create a new one. */
export function findStickyComment(
  comments: readonly IssueCommentRef[],
  marker: string,
): IssueCommentRef | null {
  return comments.find((c) => typeof c.body === "string" && c.body.includes(marker)) ?? null;
}

export interface UpsertStickyCommentOptions {
  apiBase: string;
  /** "owner/repo" */
  repository: string;
  prNumber: number;
  token: string;
  marker: string;
  body: string;
  fetchImpl?: typeof fetch;
}

/**
 * Create-or-update the sticky comment. Returns "created" | "updated".
 * Throws on HTTP errors — the CALLER decides that commenting is best-effort.
 */
export async function upsertStickyComment(
  opts: UpsertStickyCommentOptions,
): Promise<"created" | "updated"> {
  const f = opts.fetchImpl ?? fetch;
  const base = opts.apiBase.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${opts.token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  // Paginate the issue comments looking for the marker (100/page, marker is in page order).
  let existing: IssueCommentRef | null = null;
  for (let page = 1; page <= 10 && existing === null; page++) {
    const res = await f(
      `${base}/repos/${opts.repository}/issues/${opts.prNumber}/comments?per_page=100&page=${page}`,
      { headers },
    );
    if (!res.ok) throw new Error(`List comments failed: HTTP ${res.status}`);
    const batch = (await res.json()) as IssueCommentRef[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    existing = findStickyComment(batch, opts.marker);
    if (batch.length < 100) break;
  }

  if (existing) {
    const res = await f(`${base}/repos/${opts.repository}/issues/comments/${existing.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ body: opts.body }),
    });
    if (!res.ok) throw new Error(`Update comment ${existing.id} failed: HTTP ${res.status}`);
    return "updated";
  }
  const res = await f(`${base}/repos/${opts.repository}/issues/${opts.prNumber}/comments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ body: opts.body }),
  });
  if (!res.ok) throw new Error(`Create comment failed: HTTP ${res.status}`);
  return "created";
}
