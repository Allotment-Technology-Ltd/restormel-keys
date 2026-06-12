import { describe, it, expect } from "vitest";
import {
  applyExplorerAsOf,
  parseAsOfRequestFromQuery,
  projectUnitsAsOf,
} from "./graph-explorer-as-of";
import type { ConnectClaimVersionChainRow } from "$lib/server/connect-v1/temporal-validity";
import type { ConnectGraphUnitView } from "./graph-explorer-service";

function unit(id: string, text: string, extra: Partial<ConnectGraphUnitView> = {}): ConnectGraphUnitView {
  return {
    id,
    text,
    unitType: null,
    domain: null,
    validationStatus: null,
    validationNote: null,
    sourceTitle: null,
    sourceUrl: null,
    sourceKind: null,
    author: null,
    evidence: null,
    ...extra,
  };
}

function row(
  partial: Partial<ConnectClaimVersionChainRow> & Pick<ConnectClaimVersionChainRow, "unitId" | "validFrom">,
): ConnectClaimVersionChainRow {
  return {
    versionId: partial.versionId ?? `${partial.unitId}-v`,
    unitId: partial.unitId,
    claimKey: partial.claimKey ?? "chain-1",
    versionNo: partial.versionNo ?? 1,
    text: partial.text ?? `text for ${partial.unitId}`,
    verificationState: partial.verificationState ?? "supported",
    validFrom: partial.validFrom,
    validTo: partial.validTo ?? null,
    supersededBy: partial.supersededBy ?? null,
    judgedBy: partial.judgedBy ?? null,
    judgedAt: partial.judgedAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// parseAsOfRequestFromQuery
// ---------------------------------------------------------------------------

describe("parseAsOfRequestFromQuery", () => {
  const q = (rec: Record<string, string>) => (k: string) => rec[k] ?? null;

  it("returns null when neither as_of nor audit is present", () => {
    expect(parseAsOfRequestFromQuery(q({}))).toBeNull();
  });
  it("parses a valid as_of to a canonical ISO instant", () => {
    const req = parseAsOfRequestFromQuery(q({ as_of: "2026-05-03T14:02:00.000Z" }));
    expect(req).toEqual({ asOf: "2026-05-03T14:02:00.000Z", includeSuperseded: false });
  });
  it("parses audit=1 alone as a full-history audit request", () => {
    expect(parseAsOfRequestFromQuery(q({ audit: "1" }))).toEqual({
      asOf: null,
      includeSuperseded: true,
    });
  });
  it("an unparseable as_of with no audit is dropped to null", () => {
    expect(parseAsOfRequestFromQuery(q({ as_of: "garbage" }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// projectUnitsAsOf — boundary semantics (valid_from ≤ t < valid_to)
// ---------------------------------------------------------------------------

describe("projectUnitsAsOf — supersession boundary", () => {
  // Chain: v1 valid [Jan 1, May 1), v2 valid [May 1, ∞). The current unit is u2 (v2);
  // the explorer shows u2. The prior version is u1 (v1).
  const T = "2026-05-01T00:00:00.000Z";
  const rows = [
    row({ unitId: "u1", versionNo: 1, text: "v1 text", validFrom: "2026-01-01T00:00:00.000Z", validTo: T, supersededBy: "u2" }),
    row({ unitId: "u2", versionNo: 2, text: "v2 text", validFrom: T, validTo: null }),
  ];
  const units = [unit("u2", "v2 text")];

  it("at T-ε shows the OLDER version (u1) — a claim valid until T is shown at T-ε", () => {
    const res = projectUnitsAsOf({
      units,
      rows,
      asOf: new Date("2026-04-30T23:59:59.000Z"),
      includeSuperseded: false,
    });
    expect(res.units).toHaveLength(1);
    expect(res.units[0].id).toBe("u1"); // served under the prior unit id (cohort invariant)
    expect(res.units[0].text).toBe("v1 text");
    expect(res.substituted).toBe(1);
  });

  it("exactly at T shows the NEW version (u2) — half-open window excludes valid_to", () => {
    const res = projectUnitsAsOf({
      units,
      rows,
      asOf: new Date(T),
      includeSuperseded: false,
    });
    expect(res.units).toHaveLength(1);
    expect(res.units[0].id).toBe("u2");
    expect(res.units[0].text).toBe("v2 text");
    expect(res.substituted).toBe(0);
  });

  it("before the claim was born → excluded (did not exist at the instant)", () => {
    const res = projectUnitsAsOf({
      units,
      rows,
      asOf: new Date("2025-12-01T00:00:00.000Z"),
      includeSuperseded: false,
    });
    expect(res.units).toHaveLength(0);
    expect(res.excluded).toBe(1);
  });

  it("a unit with no version row is KEPT and counted as unversioned (never silently filtered)", () => {
    const res = projectUnitsAsOf({
      units: [unit("orphan", "no chain")],
      rows: [],
      asOf: new Date(T),
      includeSuperseded: false,
    });
    expect(res.units).toHaveLength(1);
    expect(res.units[0].id).toBe("orphan");
    expect(res.unversioned).toBe(1);
  });

  it("audit view appends superseded versions under their original ids", () => {
    const res = projectUnitsAsOf({ units, rows, asOf: null, includeSuperseded: true });
    const ids = res.units.map((u) => u.id).sort();
    expect(ids).toEqual(["u1", "u2"]);
    expect(res.supersededReturned).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// M1 — substituted/superseded rows must NOT inherit today's triage fields.
// A May version row carries text + verification state only; reviews write no
// version rows, so validationStatus/note/source/author are NOT reconstructible
// at the instant and must be neutralized + flagged (never shown as historical).
// ---------------------------------------------------------------------------

describe("projectUnitsAsOf — substituted-row triage neutralization (M1)", () => {
  const T = "2026-05-01T00:00:00.000Z";
  // CURRENT unit u2 carries JUNE triage fields (today's verdict, note, source, author).
  const currentUnit = unit("u2", "v2 text", {
    validationStatus: "ok",
    validationNote: "reviewed in June",
    sourceTitle: "June source",
    sourceUrl: "https://example.com/june",
    sourceKind: "doc",
    author: "June Author",
    unitType: "claim",
    domain: "philosophy",
  });
  const rows = [
    row({ unitId: "u1", versionNo: 1, text: "v1 text", validFrom: "2026-01-01T00:00:00.000Z", validTo: T, supersededBy: "u2", verificationState: "inferred" }),
    row({ unitId: "u2", versionNo: 2, text: "v2 text", validFrom: T, validTo: null }),
  ];

  it("a substituted prior version drops today's verdict/note/source/author and flags asOfHistorical", () => {
    const res = projectUnitsAsOf({
      units: [currentUnit],
      rows,
      asOf: new Date("2026-04-30T23:59:59.000Z"),
      includeSuperseded: false,
    });
    expect(res.substituted).toBe(1);
    const [served] = res.units;
    expect(served.id).toBe("u1"); // prior unit id (cohort invariant)
    expect(served.text).toBe("v1 text");
    // Today's triage/provenance fields are NEUTRALIZED — never inherited from June.
    expect(served.validationStatus).toBeNull();
    expect(served.validationNote).toBeNull();
    expect(served.sourceTitle).toBeNull();
    expect(served.sourceUrl).toBeNull();
    expect(served.sourceKind).toBeNull();
    expect(served.author).toBeNull();
    // The row is flagged so the UI labels its verdict as not-historical.
    expect(served.asOfHistorical).toBe(true);
    // Non-triage descriptive fields the version row doesn't reshape are preserved.
    expect(served.unitType).toBe("claim");
    expect(served.domain).toBe("philosophy");
    // The version row's recorded verification state IS surfaced (it was recorded at t).
    expect(served.evidence?.verificationState).toBe("inferred");
  });

  it("a KEPT (current-version) row at t is NOT flagged and keeps its current fields", () => {
    const res = projectUnitsAsOf({
      units: [currentUnit],
      rows,
      asOf: new Date(T), // exactly at T → current version u2 is live
      includeSuperseded: false,
    });
    expect(res.substituted).toBe(0);
    const [served] = res.units;
    expect(served.id).toBe("u2");
    expect(served.asOfHistorical).toBeFalsy();
    expect(served.validationStatus).toBe("ok");
  });

  it("audit-appended superseded rows are also neutralized + flagged", () => {
    const res = projectUnitsAsOf({ units: [currentUnit], rows, asOf: null, includeSuperseded: true });
    const appended = res.units.find((u) => u.id === "u1")!;
    expect(appended.asOfHistorical).toBe(true);
    expect(appended.validationStatus).toBeNull();
    expect(appended.author).toBeNull();
    // The kept current row is untouched.
    const current = res.units.find((u) => u.id === "u2")!;
    expect(current.asOfHistorical).toBeFalsy();
    expect(current.validationStatus).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// applyExplorerAsOf — provider-driven honesty
// ---------------------------------------------------------------------------

describe("applyExplorerAsOf — honest degradation by provider", () => {
  const units = [unit("u2", "v2 text")];
  const req = { asOf: "2026-05-01T00:00:00.000Z", includeSuperseded: false };

  it("requested:false when no request", async () => {
    const res = await applyExplorerAsOf({ workspaceId: "w", provider: "postgres", units, request: null });
    expect(res.asOfStatus).toEqual({ requested: false });
    expect(res.units).toBe(units);
  });

  it("Surreal degrades explicitly (history not available) and returns CURRENT units", async () => {
    const res = await applyExplorerAsOf({ workspaceId: "w", provider: "surreal", units, request: req });
    expect(res.asOfStatus).toMatchObject({
      requested: true,
      applied: false,
      reason: "surreal_version_chains_unavailable",
    });
    expect(res.units).toBe(units); // unchanged — never live data dressed as past data
  });

  it("no target degrades to graph_target_not_configured", async () => {
    const res = await applyExplorerAsOf({ workspaceId: "w", provider: null, units, request: req });
    expect(res.asOfStatus).toMatchObject({ applied: false, reason: "graph_target_not_configured" });
  });

  it("a chain-lookup failure degrades to version_lookup_failed (never throws)", async () => {
    const res = await applyExplorerAsOf({
      workspaceId: "w",
      provider: "postgres",
      units,
      request: req,
      loadChains: async () => {
        throw new Error("db down");
      },
    });
    expect(res.asOfStatus).toMatchObject({ applied: false, reason: "version_lookup_failed" });
    expect(res.units).toBe(units);
  });

  it("Postgres applies the projection via the chain loader", async () => {
    const rows = [
      row({ unitId: "u1", versionNo: 1, text: "v1 text", validFrom: "2026-01-01T00:00:00.000Z", validTo: "2026-05-01T00:00:00.000Z", supersededBy: "u2" }),
      row({ unitId: "u2", versionNo: 2, text: "v2 text", validFrom: "2026-05-01T00:00:00.000Z", validTo: null }),
    ];
    const res = await applyExplorerAsOf({
      workspaceId: "w",
      provider: "postgres",
      units,
      request: { asOf: "2026-04-30T23:59:59.000Z", includeSuperseded: false },
      loadChains: async () => rows,
    });
    expect(res.asOfStatus).toMatchObject({ requested: true, applied: true, substituted: 1 });
    expect(res.units[0].id).toBe("u1");
  });
});
