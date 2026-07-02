/**
 * Evidence Dossier service (W2.2) — pure composition tests:
 * the additive units-API shape, excerpt location, and the deterministic
 * Layer-1 re-check (claims ledger rows 2 and 9: fail-closed, no model).
 */
import { describe, expect, it, vi } from "vitest";
import { contentHash } from "@restormel/connect-core";

// The composition functions under test are pure; mock the service's IO imports so
// the module loads without a database/store (same pattern as trust-scorecard tests).
vi.mock("$lib/server/neon", () => ({
  getConnectDomainPackById: vi.fn(),
  getConnectGraphTargetForWorkspace: vi.fn(),
  getSql: vi.fn(),
  ensureIngestionRoutingSchema: vi.fn(),
  listConnectClaimEvidenceForUnitsPostgres: vi.fn(),
  listConnectClaimVersionChainsForUnitsPostgres: vi.fn(),
  listConnectDomainPacksForWorkspace: vi.fn(),
  updateConnectClaimVersionStatesPostgres: vi.fn(),
  updateUnitValidationPostgres: vi.fn(),
}));
vi.mock("$lib/server/connect/surreal-graph-store", () => ({
  buildWorkspaceGraphStore: vi.fn(),
}));
vi.mock("$lib/server/connect/domain-pack-service", () => ({
  domainPackRecordToApi: vi.fn(),
}));
vi.mock("$lib/server/connect/connect-source-text-resolve", () => ({
  fetchSurrealSourceRecordText: vi.fn(),
  resolveConnectSourceTextRaw: vi.fn(),
}));
vi.mock("$lib/server/connect/graph-writer", () => ({
  formatSurrealRecordId: vi.fn(() => null),
  surrealRecordRef: vi.fn((id: string) => id),
  REMOVED_VALIDATION_STATUS: "removed",
}));
vi.mock("$lib/server/connect/surreal-graph-units-load", () => ({
  pickSurrealUnitText: vi.fn(),
}));

import {
  acceptConnectUnitAsSupported,
  buildEvidenceExcerpt,
  composeEvidenceSummaryFromPostgresRow,
  composeEvidenceSummaryFromSurrealRow,
  recheckEvidenceSpanAgainstText,
} from "./evidence-dossier-service";
import * as neon from "$lib/server/neon";
import type { ConnectClaimEvidenceRow } from "$lib/server/neon";

const SOURCE =
  "Bentham introduced a felicific calculus. Every person's happiness counts equally in the aggregate. Later utilitarians refined the framework.";
const QUOTE = "Every person's happiness counts equally in the aggregate.";
const START = SOURCE.indexOf(QUOTE);
const END = START + QUOTE.length;

function pgRow(overrides: Partial<ConnectClaimEvidenceRow> = {}): ConnectClaimEvidenceRow {
  return {
    unitId: "kg:u1",
    claimKey: "ck-1",
    versionNo: 2,
    evidenceQuote: QUOTE,
    spanStart: START,
    spanEnd: END,
    evidenceMatch: "exact",
    evidenceStatus: "bound",
    sourceHash: "hash-1",
    verificationState: "supported",
    judgedBy: "gpt-5#pv2",
    judgedAt: "2026-06-10T09:00:00.000Z",
    boundAt: "2026-06-10T08:59:00.000Z",
    versionCount: 2,
    judgeVerdict: "entailed",
    judgeConfidence: 0.93,
    judgeModel: "gpt-5",
    judgePromptVersion: 2,
    judgeJudgedAt: "2026-06-10T09:00:00.000Z",
    ...overrides,
  };
}

describe("composeEvidenceSummaryFromPostgresRow — the units-API additive shape", () => {
  it("carries verification_state, the bound span, the judge, and the versions summary", () => {
    const s = composeEvidenceSummaryFromPostgresRow(pgRow());
    expect(s).toEqual({
      verificationState: "supported",
      evidenceStatus: "bound",
      evidence: {
        quote: QUOTE,
        start: START,
        end: END,
        match: "exact",
        sourceHash: "hash-1",
        // PR-7: the Postgres spine records no locator kind — spatial (as today).
        fidelity: "spatial",
      },
      judgedBy: "gpt-5#pv2",
      judgedAt: "2026-06-10T09:00:00.000Z",
      judge: {
        model: "gpt-5",
        promptVersion: 2,
        verdict: "entailed",
        confidence: 0.93,
        judgedAt: "2026-06-10T09:00:00.000Z",
      },
      versions: { count: 2, currentVersionNo: 2 },
      boundAt: "2026-06-10T08:59:00.000Z",
    });
  });

  it("an unbound row carries no span and never reads as supported-capable", () => {
    const s = composeEvidenceSummaryFromPostgresRow(
      pgRow({
        evidenceStatus: "unbound",
        evidenceQuote: QUOTE,
        spanStart: null,
        spanEnd: null,
        verificationState: "unverified",
      }),
    );
    expect(s.evidence).toBeNull();
    expect(s.evidenceStatus).toBe("unbound");
    expect(s.verificationState).toBe("unverified");
  });

  it("a no-evidence row is honest about having nothing to show", () => {
    const s = composeEvidenceSummaryFromPostgresRow(
      pgRow({
        evidenceStatus: "no_evidence",
        evidenceQuote: null,
        spanStart: null,
        spanEnd: null,
        evidenceMatch: null,
        verificationState: "unverified",
        judgeVerdict: null,
        judgeModel: null,
        judgeConfidence: null,
        judgePromptVersion: null,
        judgeJudgedAt: null,
      }),
    );
    expect(s.evidence).toBeNull();
    expect(s.evidenceStatus).toBe("no_evidence");
    expect(s.judge).toBeNull();
  });
});

describe("composeEvidenceSummaryFromSurrealRow", () => {
  it("reads the graph-writer's evidence_* fields", () => {
    const s = composeEvidenceSummaryFromSurrealRow({
      id: "claim:u1",
      verification_state: "inferred",
      evidence_status: "unbound",
      evidence_quote: QUOTE,
      evidence_start: null,
      evidence_end: null,
      evidence_match: null,
      evidence_source_hash: "hash-1",
      valid_from: "2026-06-10T08:00:00.000Z",
    });
    expect(s).not.toBeNull();
    expect(s!.verificationState).toBe("inferred");
    expect(s!.evidenceStatus).toBe("unbound");
    expect(s!.evidence).toBeNull();
    expect(s!.boundAt).toBe("2026-06-10T08:00:00.000Z");
  });

  it("a bound Surreal row carries the span", () => {
    const s = composeEvidenceSummaryFromSurrealRow({
      verification_state: "supported",
      evidence_status: "bound",
      evidence_quote: QUOTE,
      evidence_start: START,
      evidence_end: END,
      evidence_match: "normalized",
      evidence_source_hash: "hash-1",
    });
    expect(s!.evidence).toEqual({
      quote: QUOTE,
      start: START,
      end: END,
      match: "normalized",
      sourceHash: "hash-1",
      // PR-7: no locator-kind marker on the row — spatial (renders as today).
      fidelity: "spatial",
    });
  });

  it("an explicit textual locator-kind marker downgrades the span fidelity (PR-7)", () => {
    const s = composeEvidenceSummaryFromSurrealRow({
      verification_state: "supported",
      evidence_status: "bound",
      evidence_quote: QUOTE,
      evidence_start: START,
      evidence_end: END,
      evidence_match: "exact",
      evidence_source_hash: "hash-1",
      evidence_locator_kind: "textual",
    });
    expect(s!.evidence!.fidelity).toBe("textual");
  });

  it("returns null (pre-EBV) when the record has no EBV fields — never fabricates", () => {
    expect(
      composeEvidenceSummaryFromSurrealRow({ id: "claim:old", text: "An old claim." }),
    ).toBeNull();
  });
});

describe("buildEvidenceExcerpt", () => {
  it("locates the span by recorded offsets with surrounding context", () => {
    const ex = buildEvidenceExcerpt({ sourceText: SOURCE, quote: QUOTE, start: START, end: END });
    expect(ex.located).toBe("offsets");
    if (ex.located === "offsets" || ex.located === "search") {
      expect(ex.quote).toBe(QUOTE);
      expect(ex.before.endsWith("calculus. ")).toBe(true);
      expect(ex.after.startsWith(" Later utilitarians")).toBe(true);
    }
  });

  it("falls back to a verbatim search when offsets no longer hold", () => {
    const shifted = "PREPENDED PREFIX. " + SOURCE;
    const ex = buildEvidenceExcerpt({ sourceText: shifted, quote: QUOTE, start: START, end: END });
    expect(ex.located).toBe("search");
    if (ex.located === "search") expect(ex.quote).toBe(QUOTE);
  });

  it("reports honestly when the quote is gone from the current text", () => {
    const ex = buildEvidenceExcerpt({
      sourceText: "A completely different document.",
      quote: QUOTE,
      start: START,
      end: END,
    });
    expect(ex).toEqual({ located: "none", reason: "quote_not_in_current_text" });
  });
});

describe("recheckEvidenceSpanAgainstText — deterministic, fail-closed (ledger row 9)", () => {
  it("passes when the source still hashes the same and the quote sits at its offsets", async () => {
    const hash = await contentHash(SOURCE);
    const outcome = await recheckEvidenceSpanAgainstText({
      span: { quote: QUOTE, start: START, end: END, source_hash: hash, match: "exact" },
      sourceText: SOURCE,
      quality: "full",
    });
    expect(outcome).toMatchObject({ ok: true, match: "exact" });
  });

  it("also passes when the resolver returned padded text whose trimmed form was hashed", async () => {
    const hash = await contentHash(SOURCE);
    const outcome = await recheckEvidenceSpanAgainstText({
      span: { quote: QUOTE, start: START, end: END, source_hash: hash, match: "exact" },
      sourceText: `\n\n${SOURCE}  \n`.replace(/^\n\n/, "\n\n"), // raw text with whitespace padding
      quality: "full",
    });
    expect(outcome.ok).toBe(true);
  });

  it("fails closed with hash_mismatch when the source content changed", async () => {
    const hash = await contentHash(SOURCE);
    const outcome = await recheckEvidenceSpanAgainstText({
      span: { quote: QUOTE, start: START, end: END, source_hash: hash, match: "exact" },
      sourceText: SOURCE.replace("equally", "unequally"),
      quality: "full",
    });
    expect(outcome).toMatchObject({ ok: false, reason: "hash_mismatch" });
  });

  it("fails closed with text_changed when offsets point at different text in the same source", async () => {
    const hash = await contentHash(SOURCE);
    const outcome = await recheckEvidenceSpanAgainstText({
      span: { quote: QUOTE, start: 0, end: QUOTE.length, source_hash: hash, match: "exact" },
      sourceText: SOURCE,
      quality: "full",
    });
    expect(outcome).toMatchObject({ ok: false, reason: "text_changed" });
  });

  it("is honest when no full source text is available — unavailable, not a verdict", async () => {
    const outcome = await recheckEvidenceSpanAgainstText({
      span: { quote: QUOTE, start: START, end: END, source_hash: "h", match: "exact" },
      sourceText: "a preview…",
      quality: "preview",
    });
    expect(outcome).toMatchObject({ ok: false, reason: "source_text_unavailable" });
  });
});

describe("acceptConnectUnitAsSupported — server-side row-2 guard", () => {
  it("returns 409 for an unbound claim and never writes a state", async () => {
    vi.mocked(neon.getConnectGraphTargetForWorkspace).mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof neon.getConnectGraphTargetForWorkspace>>,
    );
    vi.mocked(neon.ensureIngestionRoutingSchema).mockResolvedValue(undefined);
    const sqlTag = () =>
      Promise.resolve([
        { id: "u1", source_title: null, source_url: null, source_kind: null, source_preview: null },
      ]);
    vi.mocked(neon.getSql).mockReturnValue(sqlTag as unknown as ReturnType<typeof neon.getSql>);
    vi.mocked(neon.listConnectClaimEvidenceForUnitsPostgres).mockResolvedValue([
      pgRow({
        evidenceStatus: "unbound",
        spanStart: null,
        spanEnd: null,
        verificationState: "unverified",
      }),
    ]);

    const res = await acceptConnectUnitAsSupported({
      workspaceId: "ws",
      unitId: "u1",
      actor: "operator:test",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(409);
      expect(res.message).toMatch(/never be marked supported/);
    }
    expect(vi.mocked(neon.updateConnectClaimVersionStatesPostgres)).not.toHaveBeenCalled();
  });
});
