/**
 * Stage 3.3 — temporal validity + as-of retrieval (verified-memory ADR §2).
 *
 * The supersession boundary case under test: a claim superseded at instant T —
 * `as_of T−ε` serves v1 (the recorded prior version), `as_of T+ε` serves v2 only, and
 * the audit flag returns both with their states and validity windows. Honesty rules:
 * stores without version chains degrade EXPLICITLY (never silently pretend), and
 * unversioned legacy claims are kept + flagged (never silently filtered).
 */
import { describe, it, expect } from "vitest";
import type { CuratedSubgraph, RetrievedClaim } from "@restormel/graphrag-core";
import {
  applyTemporalValidity,
  parseTemporalRequest,
  projectTemporalValidity,
  versionValidAt,
  type ConnectClaimVersionChainRow,
} from "./temporal-validity";

const T = "2026-06-10T00:00:00.000Z";
const BEFORE_T = "2026-06-09T23:59:59.999Z"; // T − ε
const AFTER_T = "2026-06-10T00:00:00.001Z"; // T + ε
const T0 = "2026-06-01T00:00:00.000Z";

function claim(id: string, text = `text of ${id}`): RetrievedClaim {
  return {
    id,
    text,
    claim_type: "thesis",
    domain: "ethics",
    source_title: "Nicomachean Ethics",
    source_author: [],
    confidence: 0.9,
    position_in_source: 0,
    verification_state: "supported",
    trust_score: 88,
  };
}

function subgraph(claims: RetrievedClaim[], relations: CuratedSubgraph["relations"] = []): CuratedSubgraph {
  return { claims, relations, arguments: [], seed_claim_ids: claims.slice(0, 1).map((c) => c.id) };
}

/** v1 (claim:old) superseded at T by v2 (claim:new) — one identity chain via claim_key. */
const chainRows: ConnectClaimVersionChainRow[] = [
  {
    versionId: "1",
    unitId: "claim:old",
    claimKey: "k1",
    versionNo: 1,
    text: "the OLD recorded text",
    verificationState: "supported",
    validFrom: T0,
    validTo: T,
    supersededBy: "2",
    judgedBy: "judge#pv1",
    judgedAt: T0,
  },
  {
    versionId: "2",
    unitId: "claim:new",
    claimKey: "k1",
    versionNo: 2,
    text: "the NEW current text",
    verificationState: "supported",
    validFrom: T,
    validTo: null,
    supersededBy: null,
    judgedBy: "judge#pv1",
    judgedAt: T,
  },
];

describe("versionValidAt (ADR §2: valid_from ≤ t < valid_to)", () => {
  it("treats the supersession instant as belonging to the successor, not the predecessor", () => {
    const [v1, v2] = chainRows;
    expect(versionValidAt(v1, new Date(BEFORE_T))).toBe(true);
    expect(versionValidAt(v1, new Date(T))).toBe(false); // closed at exactly T
    expect(versionValidAt(v2, new Date(T))).toBe(true); // open from exactly T
    expect(versionValidAt(v2, new Date(BEFORE_T))).toBe(false);
  });
});

describe("projectTemporalValidity — supersession boundary case", () => {
  it("as_of T−ε serves v1: the prior version's recorded text under its original unit id", () => {
    const projected = projectTemporalValidity({
      subgraph: subgraph([claim("claim:new", "the NEW current text")]),
      rows: chainRows,
      asOf: new Date(BEFORE_T),
      includeSuperseded: false,
    });
    expect(projected.subgraph.claims).toHaveLength(1);
    expect(projected.subgraph.claims[0].id).toBe("claim:old"); // cohort invariant: original id, never reshaped
    expect(projected.subgraph.claims[0].text).toBe("the OLD recorded text");
    expect(projected.stats).toMatchObject({ substituted: 1, excluded: 0, unversioned: 0 });
    expect(projected.versionsByClaimId.get("claim:old")).toMatchObject({
      valid_from: T0,
      valid_to: T,
      superseded_by: "2",
      version_no: 1,
    });
    expect(projected.changed).toBe(true);
  });

  it("as_of T+ε serves v2 only — the superseded version does not leak back in", () => {
    const projected = projectTemporalValidity({
      subgraph: subgraph([claim("claim:new", "the NEW current text")]),
      rows: chainRows,
      asOf: new Date(AFTER_T),
      includeSuperseded: false,
    });
    expect(projected.subgraph.claims.map((c) => c.id)).toEqual(["claim:new"]);
    expect(projected.stats).toMatchObject({ substituted: 0, excluded: 0 });
    expect(projected.versionsByClaimId.get("claim:new")).toMatchObject({
      valid_from: T,
      valid_to: null,
      superseded_by: null,
      version_no: 2,
    });
    expect(projected.changed).toBe(false);
  });

  it("audit flag returns BOTH versions with their recorded states and validity windows", () => {
    const projected = projectTemporalValidity({
      subgraph: subgraph([claim("claim:new", "the NEW current text")]),
      rows: chainRows,
      asOf: null,
      includeSuperseded: true,
    });
    expect(projected.subgraph.claims.map((c) => c.id).sort()).toEqual(["claim:new", "claim:old"]);
    const audit = projected.subgraph.claims.find((c) => c.id === "claim:old");
    expect(audit?.text).toBe("the OLD recorded text");
    expect(audit?.verification_state).toBe("supported"); // recorded history, kept (never re-opened)
    expect(audit?.trust_score).toBeNull(); // current-version trust is NOT inherited by old versions
    expect(projected.stats.supersededReturned).toBe(1);
    expect(projected.versionsByClaimId.get("claim:old")?.valid_to).toBe(T);
    expect(projected.versionsByClaimId.get("claim:new")?.valid_to).toBeNull();
  });

  it("drops claims whose chain did not exist at as_of, and re-indexes relations", () => {
    // claim:born-later has a single version starting at T; relation a→b must survive remap.
    const rows: ConnectClaimVersionChainRow[] = [
      ...chainRows.map((r) => ({ ...r })),
      {
        versionId: "3",
        unitId: "claim:born-later",
        claimKey: "k2",
        versionNo: 1,
        text: "born at T",
        verificationState: "unverified",
        validFrom: T,
        validTo: null,
        supersededBy: null,
        judgedBy: null,
        judgedAt: null,
      },
    ];
    const projected = projectTemporalValidity({
      subgraph: subgraph(
        [claim("claim:a-legacy"), claim("claim:born-later"), claim("claim:new")],
        [
          { from_index: 0, to_index: 2, relation_type: "supports" },
          { from_index: 1, to_index: 2, relation_type: "supports" }, // touches the dropped claim
        ],
      ),
      rows,
      asOf: new Date(BEFORE_T),
      includeSuperseded: false,
    });
    // a-legacy (no version rows) kept + flagged; born-later dropped; new → substituted by old.
    expect(projected.subgraph.claims.map((c) => c.id)).toEqual(["claim:a-legacy", "claim:old"]);
    expect(projected.stats).toMatchObject({ unversioned: 1, excluded: 1, substituted: 1 });
    expect(projected.subgraph.relations).toEqual([
      { from_index: 0, to_index: 1, relation_type: "supports" },
    ]);
  });

  it("keeps unversioned (legacy) claims and counts them — never silently filtered", () => {
    const projected = projectTemporalValidity({
      subgraph: subgraph([claim("claim:legacy")]),
      rows: [],
      asOf: new Date(BEFORE_T),
      includeSuperseded: false,
    });
    expect(projected.subgraph.claims.map((c) => c.id)).toEqual(["claim:legacy"]);
    expect(projected.stats.unversioned).toBe(1);
    // No version block is fabricated for it: validity unknown stays unknown.
    expect(projected.versionsByClaimId.has("claim:legacy")).toBe(false);
  });
});

describe("applyTemporalValidity — store capability + explicit degradation", () => {
  const request = { asOf: BEFORE_T, includeSuperseded: false };
  const base = subgraph([claim("claim:new", "the NEW current text")]);

  it("runs the projection against the Postgres spine chains", async () => {
    const outcome = await applyTemporalValidity({
      workspaceId: "ws-1",
      provider: "postgres",
      subgraph: base,
      request,
      loadChains: async () => chainRows,
    });
    expect(outcome.metadata).toMatchObject({
      as_of: BEFORE_T,
      applied: true,
      include_superseded: false,
      excluded_claims: 0,
      substituted_claims: 1,
      unversioned_claims: 0,
    });
    expect(outcome.subgraph.claims[0].id).toBe("claim:old");
  });

  it("degrades EXPLICITLY for Surreal BYO stores (no version chains until Stage 3.2b)", async () => {
    const outcome = await applyTemporalValidity({
      workspaceId: "ws-1",
      provider: "surreal",
      subgraph: base,
      request,
      loadChains: async () => {
        throw new Error("must not be consulted for surreal");
      },
    });
    expect(outcome.metadata.applied).toBe(false);
    expect(outcome.metadata.degraded_reason).toBe("surreal_version_chains_unavailable");
    // Claims pass through UNFILTERED — degraded, flagged, never silently pretended.
    expect(outcome.subgraph).toBe(base);
    expect(outcome.changed).toBe(false);
  });

  it("degrades explicitly when no graph target exists or the chain lookup fails", async () => {
    const noTarget = await applyTemporalValidity({
      workspaceId: "ws-1",
      provider: null,
      subgraph: base,
      request,
    });
    expect(noTarget.metadata).toMatchObject({
      applied: false,
      degraded_reason: "graph_target_not_configured",
    });

    const lookupFailed = await applyTemporalValidity({
      workspaceId: "ws-1",
      provider: "postgres",
      subgraph: base,
      request,
      loadChains: async () => {
        throw new Error("spine offline");
      },
    });
    expect(lookupFailed.metadata).toMatchObject({
      applied: false,
      degraded_reason: "version_lookup_failed",
    });
    expect(lookupFailed.subgraph).toBe(base);
  });
});

describe("parseTemporalRequest", () => {
  it("returns null when nothing temporal was asked for", () => {
    expect(parseTemporalRequest({})).toBeNull();
    expect(parseTemporalRequest({ include_superseded: false })).toBeNull();
  });

  it("normalizes as_of / include_superseded", () => {
    expect(parseTemporalRequest({ as_of: T })).toEqual({ asOf: T, includeSuperseded: false });
    expect(parseTemporalRequest({ include_superseded: true })).toEqual({
      asOf: null,
      includeSuperseded: true,
    });
  });
});
