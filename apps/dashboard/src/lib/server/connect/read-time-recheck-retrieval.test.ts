import { describe, expect, it, vi } from "vitest";
import {
  applyReadTimeRecheckToEnvelopes,
  mapDossierRecheckOutcome,
  type ResolveClaimRecheck,
} from "$lib/server/connect/read-time-recheck-retrieval";
import type { VerifiedClaimEnvelope } from "@restormel/contracts";
import type { RecheckOutcome } from "$lib/connect/evidence-dossier";

function env(
  id: string,
  state: VerifiedClaimEnvelope["state"],
  hasSpan = true,
): VerifiedClaimEnvelope {
  return {
    claim: { id, text: `claim ${id}` },
    state,
    evidence: hasSpan
      ? [{ quote: "q", offsets: [0, 1], source_ref: "source:s", source_hash: "h", match: "exact" }]
      : [],
    citation: null,
    trace_ref: null,
  };
}

const AT = "2026-06-28T10:00:00.000Z";
const ok: RecheckOutcome = { ok: true, match: "exact", checkedAt: AT };
const stale: RecheckOutcome = { ok: false, reason: "hash_mismatch", checkedAt: AT };
const unavailable: RecheckOutcome = { ok: false, reason: "source_text_unavailable", checkedAt: AT };

describe("mapDossierRecheckOutcome", () => {
  it("maps every dossier reason onto the canonical read-time outcome", () => {
    expect(mapDossierRecheckOutcome(ok)).toEqual({ ok: true, match: "exact" });
    expect(mapDossierRecheckOutcome(stale)).toEqual({ ok: false, reason: "stale_source" });
    expect(mapDossierRecheckOutcome({ ok: false, reason: "text_changed", checkedAt: AT })).toEqual({
      ok: false,
      reason: "span_lost",
    });
    expect(
      mapDossierRecheckOutcome({ ok: false, reason: "offsets_out_of_range", checkedAt: AT }),
    ).toEqual({ ok: false, reason: "offsets_out_of_range" });
    expect(mapDossierRecheckOutcome({ ok: false, reason: "no_bound_span", checkedAt: AT })).toEqual({
      ok: false,
      reason: "no_bound_span",
    });
    expect(mapDossierRecheckOutcome(unavailable)).toEqual({ ok: false, reason: "source_unavailable" });
  });
});

describe("applyReadTimeRecheckToEnvelopes", () => {
  it("relabels rotted supported claims to unverified and recomputes the summary", async () => {
    const claims = [
      env("a", "supported"),
      env("b", "supported"),
      env("c", "supported"),
    ];
    const resolve: ResolveClaimRecheck = async (id) => (id === "a" ? ok : stale);

    const applied = await applyReadTimeRecheckToEnvelopes({ verifiedClaims: claims, resolve, now: new Date(AT) });

    expect(applied.verifiedClaims.find((c) => c.claim.id === "a")!.state).toBe("supported");
    expect(applied.verifiedClaims.find((c) => c.claim.id === "b")!.state).toBe("unverified");
    expect(applied.verifiedClaims.find((c) => c.claim.id === "c")!.state).toBe("unverified");
    expect(applied.demotedIds.sort()).toEqual(["b", "c"]);
    expect(applied.verificationSummary).toEqual({ supported: 1, unverified: 2 });
    expect(applied.summary).toMatchObject({ applied: true, rechecked: 3, fresh: 1, demoted: 2 });
    expect(applied.summary.demoted_by_reason).toEqual({ stale_source: 2 });
  });

  it("fails closed when the source text cannot be resolved", async () => {
    const claims = [env("a", "supported")];
    const applied = await applyReadTimeRecheckToEnvelopes({
      verifiedClaims: claims,
      resolve: async () => unavailable,
      now: new Date(AT),
    });
    expect(applied.verifiedClaims[0]!.state).toBe("unverified");
    expect(applied.summary.demoted_by_reason).toEqual({ source_unavailable: 1 });
  });

  it("does NOT recheck non-gated states (no resolver call) and never promotes them", async () => {
    const claims = [env("u", "unverified"), env("x", "excluded"), env("k", "contradicted")];
    const resolve = vi.fn<ResolveClaimRecheck>(async () => ok);
    const applied = await applyReadTimeRecheckToEnvelopes({ verifiedClaims: claims, resolve, now: new Date(AT) });
    expect(resolve).not.toHaveBeenCalled();
    expect(applied.demotedIds).toEqual([]);
    expect(applied.summary.applied).toBe(false);
    expect(applied.verifiedClaims.map((c) => c.state)).toEqual(["unverified", "excluded", "contradicted"]);
  });

  it("leaves inferred-with-no-span untouched but demotes inferred-with-rotted-span", async () => {
    const claims = [env("i1", "inferred", false), env("i2", "inferred", true)];
    const resolve: ResolveClaimRecheck = async (id) =>
      id === "i1" ? { ok: false, reason: "no_bound_span", checkedAt: AT } : stale;
    const applied = await applyReadTimeRecheckToEnvelopes({ verifiedClaims: claims, resolve, now: new Date(AT) });
    expect(applied.verifiedClaims.find((c) => c.claim.id === "i1")!.state).toBe("inferred");
    expect(applied.verifiedClaims.find((c) => c.claim.id === "i2")!.state).toBe("unverified");
    expect(applied.demotedIds).toEqual(["i2"]);
  });

  it("emits audit rows only for claims a fresh pass actually ran for", async () => {
    const claims = [env("a", "supported"), env("u", "unverified")];
    const applied = await applyReadTimeRecheckToEnvelopes({
      verifiedClaims: claims,
      resolve: async () => stale,
      now: new Date(AT),
    });
    expect(applied.auditRows).toEqual([{ unitId: "a", result: "stale_source", checkedAt: AT }]);
  });
});
