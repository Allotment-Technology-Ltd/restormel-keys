import { describe, it, expect } from "vitest";
import {
  loadAllRecords,
  loadPublicRecords,
  isPublic,
  isPublishable,
  versionsFor,
  PUBLIC,
  APPROVED,
  NON_PUBLIC,
  type RecordDoc,
} from "./gate";

describe("publish classification gate (Phase 5 — REC-PLAN-005)", () => {
  const all = loadAllRecords();
  const published = loadPublicRecords();

  it("loads managed records from the repo (loader sanity)", () => {
    // If this is 0 the loader is broken and the leak assertions below would be vacuously true.
    expect(all.length).toBeGreaterThan(0);
  });

  it("the repo currently contains non-public records that MUST be gated out", () => {
    const nonPublic = all.filter((r) => !isPublic(r));
    // Sanity: there is genuinely something to leak (today everything is `internal`).
    expect(nonPublic.length).toBeGreaterThan(0);
  });

  // ── the acceptance test ──────────────────────────────────────────────
  it("NEVER leaks a non-public record to the public set", () => {
    const leaked = published.filter(
      (r) => (NON_PUBLIC as readonly string[]).includes(r.classification) || r.classification !== PUBLIC,
    );
    expect(leaked.map((r) => `${r.path} [${r.classification}]`)).toEqual([]);
  });

  it("every published record is classification: public — no exceptions", () => {
    for (const r of published) expect(r.classification).toBe(PUBLIC);
  });

  it("every published record is status: approved — drafts never publish", () => {
    for (const r of published) expect(r.status).toBe(APPROVED);
  });

  it("NEVER publishes a public-but-unapproved record (e.g. trust page draft)", () => {
    // A record may be classification: public but status: draft (pending review) — it must be held.
    const publicNotApproved = all.filter((r) => r.classification === PUBLIC && r.status !== APPROVED);
    const publishedPaths = new Set(published.map((r) => r.path));
    for (const r of publicNotApproved) expect(publishedPaths.has(r.path)).toBe(false);
  });

  it("gate predicate requires BOTH public and approved", () => {
    expect(isPublishable({ classification: "public", status: "approved" })).toBe(true);
    expect(isPublishable({ classification: "public", status: "draft" })).toBe(false);
    expect(isPublishable({ classification: "internal", status: "approved" })).toBe(false);
    expect(isPublishable({ classification: "", status: "approved" })).toBe(false);
  });

  it("public and non-public path sets are disjoint", () => {
    const publicPaths = new Set(published.map((r) => r.path));
    const nonPublicPaths = all.filter((r) => !isPublic(r)).map((r) => r.path);
    for (const p of nonPublicPaths) expect(publicPaths.has(p)).toBe(false);
  });

  it("`evidence/` is never scanned (append-only proof, never public)", () => {
    expect(all.some((r) => r.path.startsWith("evidence/"))).toBe(false);
    expect(published.some((r) => r.path.startsWith("evidence/"))).toBe(false);
  });

  it("a missing classification field is treated as non-public (fail-closed)", () => {
    const noClass: RecordDoc = mkRecord({ id: "REC-X", classification: "" });
    expect(isPublic(noClass)).toBe(false);
  });
});

describe("version history (effective dates + supersedes lineage)", () => {
  it("builds prior versions from the supersedes lineage (dates only, never predecessor bodies)", () => {
    const v2 = mkRecord({
      id: "REC-LEG-002",
      classification: "public",
      effectiveDate: "2026-06-01",
      supersedes: ["REC-LEG-001"],
    });
    const v1 = mkRecord({ id: "REC-LEG-001", effectiveDate: "2025-01-15" });
    const byId = new Map([v2, v1].map((r) => [r.id, r]));

    const versions = versionsFor(v2, byId);
    const dates = versions.map((x) => x.date);
    // The predecessor's effective date appears as a prior version, newest-first.
    expect(dates).toContain("2025-01-15");
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
    // Only dates/notes cross over — no predecessor body is exposed.
    expect(JSON.stringify(versions)).not.toContain("body");
  });

  it("follows a multi-step supersedes chain without cycling", () => {
    const c = mkRecord({ id: "C", classification: "public", effectiveDate: "2026-03-01", supersedes: ["B"] });
    const b = mkRecord({ id: "B", effectiveDate: "2025-06-01", supersedes: ["A"] });
    const a = mkRecord({ id: "A", effectiveDate: "2024-01-01", supersedes: ["C"] }); // cycle back to C
    const byId = new Map([a, b, c].map((r) => [r.id, r]));
    const dates = versionsFor(c, byId).map((x) => x.date);
    expect(dates).toContain("2025-06-01");
    expect(dates).toContain("2024-01-01");
    expect(dates.length).toBeLessThan(10); // terminates despite the cycle
  });
});

function mkRecord(p: Partial<RecordDoc>): RecordDoc {
  return {
    id: p.id ?? "REC-T",
    slug: p.slug ?? (p.id ?? "rec").toLowerCase(),
    path: p.path ?? `legal/${p.id ?? "rec"}.md`,
    classification: p.classification ?? "",
    class: p.class ?? "legal",
    title: p.title ?? "Test record",
    status: p.status ?? "approved",
    owner: p.owner ?? "founder",
    body: p.body ?? "body text",
    frontMatter: p.frontMatter ?? {},
    supersedes: p.supersedes ?? [],
    effectiveDate: p.effectiveDate ?? "",
  };
}
