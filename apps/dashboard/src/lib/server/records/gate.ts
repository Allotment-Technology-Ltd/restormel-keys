/**
 * Build-time classification gate for the publish layer (Phase 5 — REC-PLAN-005).
 *
 * ONE definition of "public". This reuses the records front-matter parser from
 * `scripts/records/lib.mjs` (never forked) so the dashboard, the governance tooling, and
 * the Drive mirror all read a record's `classification` the same way.
 *
 * The PUBLIC web gate is the strictest reading of that field: **only
 * `classification: public` records may reach a public route.** `internal`/`confidential`/
 * `restricted` never pass. (The Drive mirror additionally allows `internal` because it is
 * an internal authoring surface; public web routes do not — same field, stricter threshold.)
 *
 * Server-only (`$lib/server`, never client-bundled) and read at build/prerender time, so
 * non-public record bodies never enter the client bundle or the prerendered HTML.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
// Parser is vendored locally (see ./frontmatter) — the shared scripts/records/lib.mjs
// escapes the SvelteKit app root and vite build/Rollup cannot bundle it. Keep in sync.
import { parseFrontMatter } from "./frontmatter";

/** Repo root, resolved from this module's location (robust under prerender — not cwd). */
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");

/**
 * Roots that may hold a publishable record. `evidence/` is deliberately excluded
 * (append-only proof — never public), mirroring the Drive mirror's exclusion.
 */
const PUBLISHABLE_ROOTS = ["docs", "planning", "governance", "decisions", "records", "legal", "people"];

export const PUBLIC = "public";
export const APPROVED = "approved";
export const NON_PUBLIC = ["internal", "confidential", "restricted"] as const;

export interface RecordDoc {
  id: string;
  /** url slug — the file basename without `.md` (e.g. `privacy-policy`) */
  slug: string;
  /** repo-relative path */
  path: string;
  /** raw `classification` value ("" if the field is missing) */
  classification: string;
  class: string;
  title: string;
  status: string;
  owner: string;
  /** markdown body (after the front-matter block) */
  body: string;
  frontMatter: Record<string, string | string[]>;
  supersedes: string[];
  /** approved-on || created || earliest git commit date (YYYY-MM-DD) */
  effectiveDate: string;
}

export interface RecordVersion {
  date: string;
  sha?: string;
  source: "git" | "superseded" | "front-matter";
  note?: string;
}

export interface PublishedRecord extends RecordDoc {
  versions: RecordVersion[];
}

const fmStr = (fm: Record<string, string | string[]>, key: string): string => {
  const v = fm[key];
  return Array.isArray(v) ? v.join(", ") : (v ?? "");
};
const fmList = (fm: Record<string, string | string[]>, key: string): string[] => {
  const v = fm[key];
  if (Array.isArray(v)) return v;
  return v ? [v] : [];
};

const FRONT_MATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const bodyOf = (content: string): string => content.replace(FRONT_MATTER_RE, "").trim();

function walk(dir: string, acc: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const fp = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "archive" || e.name === "node_modules") continue;
      walk(fp, acc);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      acc.push(fp);
    }
  }
  return acc;
}

/** Git commit history for a file → versions (newest first). Best-effort; empty if git fails. */
function gitVersions(relPath: string): RecordVersion[] {
  try {
    const out = execFileSync("git", ["log", "--follow", "--format=%H%x09%cI", "--", relPath], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
    if (!out) return [];
    return out
      .split("\n")
      .map((line) => {
        const [sha, iso] = line.split("\t");
        return { date: (iso || "").slice(0, 10), sha: (sha || "").slice(0, 8), source: "git" as const };
      })
      .filter((v) => v.date);
  } catch {
    return [];
  }
}

/** Load every record (all classifications) with parsed front-matter. */
export function loadAllRecords(): RecordDoc[] {
  const recs: RecordDoc[] = [];
  for (const root of PUBLISHABLE_ROOTS) {
    const abs = join(REPO_ROOT, root);
    if (!existsSync(abs)) continue;
    for (const fp of walk(abs)) {
      const content = readFileSync(fp, "utf8");
      const fm = parseFrontMatter(content);
      if (!fm) continue; // unstamped file — not a managed record
      const path = relative(REPO_ROOT, fp).split(sep).join("/");
      const created = fmStr(fm, "created");
      const approvedOn = fmStr(fm, "approved-on");
      const effective = fmStr(fm, "effective"); // explicit effective date wins (legal docs)
      recs.push({
        id: fmStr(fm, "id") || path,
        slug: path.split("/").pop()!.replace(/\.md$/, ""),
        path,
        classification: fmStr(fm, "classification"),
        class: fmStr(fm, "class"),
        title: fmStr(fm, "title") || path,
        status: fmStr(fm, "status"),
        owner: fmStr(fm, "owner"),
        body: bodyOf(content),
        frontMatter: fm,
        supersedes: fmList(fm, "supersedes"),
        effectiveDate: effective || approvedOn || created || (gitVersions(path).at(-1)?.date ?? ""),
      });
    }
  }
  return recs;
}

/** Classification check only (used by tests to enumerate the non-public set). */
export function isPublic(r: { classification: string }): boolean {
  return r.classification === PUBLIC;
}

/**
 * THE GATE: a record may reach a public route iff it is BOTH `classification: public`
 * AND `status: approved`. A draft/deprecated/superseded public record is held back —
 * publishing unreviewed wording is the same risk as leaking a non-public one.
 */
export function isPublishable(r: { classification: string; status: string }): boolean {
  return r.classification === PUBLIC && r.status === APPROVED;
}

/** Effective dates + prior versions from the supersedes lineage and git history (dates only — never bodies of non-public predecessors). */
export function versionsFor(r: RecordDoc, byId: Map<string, RecordDoc>): RecordVersion[] {
  const versions: RecordVersion[] = [...gitVersions(r.path)];
  // Walk the supersedes lineage, adding each predecessor's effective date (metadata only).
  const seen = new Set<string>([r.id]);
  let frontier = [...r.supersedes];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      const prev = byId.get(id);
      if (!prev) continue;
      versions.push({ date: prev.effectiveDate, source: "superseded", note: `superseded ${id}` });
      next.push(...prev.supersedes);
    }
    frontier = next;
  }
  // Dedupe by date (keep richest source), newest first.
  const byDate = new Map<string, RecordVersion>();
  for (const v of versions) {
    if (!v.date) continue;
    if (!byDate.has(v.date)) byDate.set(v.date, v);
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * The published set: ONLY `public` records, optionally narrowed by `class`. Enriched with
 * version history. This is the single source a public route may render from.
 */
export function loadPublicRecords(opts?: { class?: string }): PublishedRecord[] {
  const all = loadAllRecords();
  const byId = new Map(all.map((r) => [r.id, r]));
  return all
    .filter(isPublishable) // ← the gate: classification public AND status approved
    .filter((r) => !opts?.class || r.class === opts.class)
    .map((r) => ({ ...r, versions: versionsFor(r, byId) }))
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || a.title.localeCompare(b.title));
}

/** A public record by slug (gated). Returns null if it is not publishable or not found. */
export function loadPublicRecordBySlug(slug: string): PublishedRecord | null {
  return loadPublicRecords().find((r) => r.slug === slug) ?? null;
}
