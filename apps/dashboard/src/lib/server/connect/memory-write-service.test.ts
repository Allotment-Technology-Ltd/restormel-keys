/**
 * Stage 3.4 — agent memory write path acceptance tests (no DB, no LLM keys):
 *
 *   1. Observations run the SAME EBV gate as ingest: bound + entailed → supported;
 *      a bound quote the judge rejects goes through remediation (drop → excluded);
 *      no evidence → local abstention → unverified (review) — NEVER supported.
 *   2. A quote that does not appear in its own submitted context does not bind
 *      (evidence_unbound) and lands in review.
 *   3. Claim versions are written through the Stage 3.2 machinery (claim_key,
 *      version_no 1) with provenance kind "agent_observation" + key identity.
 *   4. Abstained observations are review-queue items — never remediation inputs.
 *   5. Rejected/weak observations come back with transparent reasons.
 */
import { describe, expect, it, vi } from "vitest";
import type { ClaimVerificationState, PriorClaimVersion } from "@restormel/connect-core";
import type { ClaimVersionBinding, GraphWriter, StoredUnit } from "$lib/server/connect/graph-writer";

vi.mock("$lib/server/neon", () => ({
  getConnectGraphTargetForWorkspace: vi.fn(async () => null),
  invalidateConnectGraphStatsCache: vi.fn(async () => {}),
}));
vi.mock("$lib/server/connect/domain-pack-service", () => ({
  resolveWorkspaceDomainPack: vi.fn(async () => null),
}));
vi.mock("$lib/server/connect/stage-route-generate", () => ({
  buildKnowledgeStageGenerates: vi.fn(),
  isConnectIngestLlmReady: vi.fn(async () => false),
}));
vi.mock("$lib/server/connect/stage-routing", () => ({
  resolveKnowledgeRouteExecutionContext: vi.fn(async () => null),
}));
vi.mock("$lib/server/module-flags", () => ({
  resolveModuleFlagsSync: () => ({}),
  isModuleEnabled: () => true,
}));

import {
  buildObservationCorpus,
  executeConnectMemoryWrite,
  observationLocalId,
  outcomeForState,
  type MemoryWriteDeps,
} from "$lib/server/connect/memory-write-service";
import { ConnectDomainPackSchema, DEFAULT_GENERIC_DOMAIN_PACK } from "@restormel/contracts/connect";

const PACK = ConnectDomainPackSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  workspace_id: "22222222-2222-4222-8222-222222222222",
  ...DEFAULT_GENERIC_DOMAIN_PACK,
  quality_preset: "starter",
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
});

const AUTH = {
  userId: "user-1",
  projectId: "proj-1",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  authType: "gateway_key",
};

// ── In-memory GraphWriter (mirrors the Postgres spine semantics) ──────────────

type FakeClaimVersion = {
  id: string;
  unitId: string;
  claimKey: string | null;
  versionNo: number;
  text: string;
  sourceHash: string | null;
  verificationState: string;
};

class FakeGraphWriter implements GraphWriter {
  readonly provider = "postgres" as const;
  sources: { id: string; title: string; sourceKind: string; sourceKey: string | null; textPreview: string | null }[] = [];
  units: { id: string; sourceId: string; text: string }[] = [];
  claimVersions: FakeClaimVersion[] = [];
  validationByUnitId = new Map<string, { status: string; note: string | null }>();
  judgments: { unitId: string; verdict: string }[] = [];
  embedded: string[] = [];
  private seq = 0;

  async writeSource(s: {
    title: string;
    sourceKind: string;
    sourceKey?: string | null;
    textPreview: string | null;
  }) {
    const id = `src-${++this.seq}`;
    this.sources.push({
      id,
      title: s.title,
      sourceKind: s.sourceKind,
      sourceKey: s.sourceKey ?? null,
      textPreview: s.textPreview,
    });
    return id;
  }

  async findSourceVersion(): Promise<{ sourceId: string; contentHash: string | null } | null> {
    return null;
  }
  async touchSourceSeen() {}
  async listCurrentClaimVersions(): Promise<PriorClaimVersion[]> {
    return [];
  }
  async supersedeClaimVersions(rows: { versionId: string; supersededBy: string | null }[]) {
    return { persisted: rows.length, missed: 0 };
  }

  async writeUnitsAndRelations(args: {
    sourceId: string;
    units: { localId: string; text: string; unitType: string | null }[];
    relations: unknown[];
  }) {
    const stored: StoredUnit[] = args.units.map((u) => {
      const id = `u-${++this.seq}`;
      this.units.push({ id, sourceId: args.sourceId, text: u.text });
      return { id, localId: u.localId, text: u.text, type: u.unitType };
    });
    return { units: stored, relations: args.relations.length };
  }

  async storeGroups() {
    return { groups: 0 };
  }
  async setEmbeddings(pairs: { unitId: string; vector: number[] }[]) {
    this.embedded.push(...pairs.map((p) => p.unitId));
    return pairs.length;
  }
  async setValidation(results: { unitId: string; status: string; note: string | null }[]) {
    for (const r of results) {
      this.validationByUnitId.set(r.unitId, { status: r.status, note: r.note });
    }
    return results.length;
  }
  async setEvidence(args: { sourceHash: string; bindings: ClaimVersionBinding[] }) {
    const versionIdByUnitId = new Map<string, string>();
    for (const b of args.bindings) {
      const id = `v-${++this.seq}`;
      this.claimVersions.push({
        id,
        unitId: b.unitId,
        claimKey: b.claimKey ?? null,
        versionNo: b.versionNo ?? 1,
        text: b.text,
        sourceHash: args.sourceHash,
        verificationState: b.carried?.verificationState ?? "unverified",
      });
      versionIdByUnitId.set(b.unitId, id);
    }
    return { persisted: args.bindings.length, missed: 0, versionIdByUnitId };
  }
  async setVerificationStates(
    states: { unitId: string; state: ClaimVerificationState; judgedBy?: string | null }[],
  ) {
    for (const s of states) {
      for (const v of this.claimVersions) {
        if (v.unitId === s.unitId) v.verificationState = s.state;
      }
    }
    return { persisted: states.length, missed: 0 };
  }
  async recordJudgments(rows: { unitId: string; verdict: string }[]) {
    this.judgments.push(...rows.map((r) => ({ unitId: r.unitId, verdict: r.verdict })));
    return { persisted: rows.length, missed: 0 };
  }
  async updateUnitText(unitId: string, text: string) {
    const u = this.units.find((x) => x.id === unitId);
    if (u) u.text = text;
  }
  async deleteUnit() {}
  async excludeUnit(unitId: string, note: string) {
    this.validationByUnitId.set(unitId, { status: "removed", note });
  }
}

// ── Deterministic generate stubs (no LLM keys) ────────────────────────────────

/** Entailment judge: claims mentioning "moon" are rejected, everything else entailed. */
function makeValidationGenerate() {
  return vi.fn(async ({ user }: { system: string; user: string }) => {
    const results = [...user.matchAll(/CLAIM (e\d+): ([^\n]+)/g)].map((m) => ({
      ref: m[1],
      verdict: m[2].includes("moon") ? "not_entailed" : "entailed",
      confidence: 0.9,
      note: m[2].includes("moon") ? "span does not support the claim" : undefined,
    }));
    return JSON.stringify({ results });
  });
}

/** Remediation model: drops everything it is shown, confidently. */
function makeRemediationGenerate() {
  return vi.fn(async ({ user }: { system: string; user: string }) => {
    const results = [...user.matchAll(/^- (r\d+)/gm)].map((m) => ({
      ref: m[1],
      action: "drop",
      confidence: 0.9,
    }));
    return JSON.stringify({ results });
  });
}

function makeDeps(writer: FakeGraphWriter, overrides?: Partial<MemoryWriteDeps>): MemoryWriteDeps {
  return {
    writer,
    pack: PACK,
    validationGenerate: makeValidationGenerate(),
    remediationGenerate: makeRemediationGenerate(),
    embed: async (texts: string[]) => texts.map(() => [0.1, 0.2]),
    ...overrides,
  };
}

const OBS_SUPPORTED = {
  text: "Paris is the capital of France.",
  evidence: {
    quote: "Paris is the capital of France",
    source_ref: "https://example.com/geo",
    context: "The geography handbook notes that Paris is the capital of France and lies on the Seine.",
  },
};
const OBS_NO_EVIDENCE = { text: "The deploy finished without errors." };
const OBS_NOT_ENTAILED = {
  text: "The moon is made of cheese.",
  evidence: {
    quote: "The moon orbits the Earth",
    context: "Basic astronomy: The moon orbits the Earth roughly every 27 days.",
  },
};
const OBS_UNBOUND = {
  text: "The CFO approved the budget.",
  evidence: {
    quote: "the budget was approved by the CFO",
    context: "Meeting notes: attendance was low and the agenda slipped.",
  },
};

describe("buildObservationCorpus", () => {
  it("lays out one labeled block per observation, storing context (or quote) verbatim", () => {
    const corpus = buildObservationCorpus([OBS_SUPPORTED, OBS_NO_EVIDENCE, { text: "x", evidence: { quote: "just a quote" } }]);
    expect(corpus).toContain("[observation 1] source: https://example.com/geo");
    expect(corpus).toContain(OBS_SUPPORTED.evidence.context);
    expect(corpus).toContain("[observation 2] source: unreferenced");
    expect(corpus).toContain("(no evidence supplied)");
    expect(corpus).toContain("[observation 3] source: unreferenced\njust a quote");
  });

  it("is deterministic", () => {
    expect(buildObservationCorpus([OBS_SUPPORTED])).toEqual(buildObservationCorpus([OBS_SUPPORTED]));
  });
});

describe("outcomeForState", () => {
  it("maps EBV states to caller outcomes", () => {
    expect(outcomeForState("supported")).toBe("accepted");
    expect(outcomeForState("inferred")).toBe("accepted");
    expect(outcomeForState("unverified")).toBe("review");
    expect(outcomeForState("contradicted")).toBe("review");
    expect(outcomeForState("excluded")).toBe("rejected");
  });
});

describe("executeConnectMemoryWrite", () => {
  it("runs the full EBV gate: supported / review / rejected / unbound per observation", async () => {
    const writer = new FakeGraphWriter();
    const deps = makeDeps(writer);
    const outcome = await executeConnectMemoryWrite({
      auth: AUTH,
      keyId: "key-abc",
      observations: [OBS_SUPPORTED, OBS_NO_EVIDENCE, OBS_NOT_ENTAILED, OBS_UNBOUND],
      requestId: "req-1",
      deps,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { body } = outcome;

    // Provenance: agent_observation + submitting key identity (never raw key material).
    expect(body.provenance).toEqual({
      kind: "agent_observation",
      key_id: "key-abc",
      auth_type: "gateway_key",
    });
    expect(writer.sources).toHaveLength(1);
    expect(writer.sources[0].sourceKind).toBe("agent_observation");
    expect(writer.sources[0].sourceKey).toBe("agent:req-1");
    expect(writer.sources[0].title).toContain("key key-abc");

    expect(body.results).toHaveLength(4);
    const [r1, r2, r3, r4] = body.results;

    // 1: bound + entailed → supported, accepted.
    expect(r1.verification_state).toBe("supported");
    expect(r1.evidence_binding).toBe("bound");
    expect(r1.outcome).toBe("accepted");

    // 2: no evidence → local abstention → unverified review; transparent reason.
    expect(r2.verification_state).toBe("unverified");
    expect(r2.evidence_binding).toBe("no_evidence");
    expect(r2.outcome).toBe("review");
    expect(r2.reasons.join(" ")).toContain("no_evidence");
    expect(r2.reasons.join(" ")).toContain("never supported");

    // 3: bound but NOT entailed → remediation dropped it → excluded, rejected, reasons.
    expect(r3.verification_state).toBe("excluded");
    expect(r3.outcome).toBe("rejected");
    expect(r3.reasons.join(" ")).toContain("entailment_not_entailed");
    expect(r3.reasons.join(" ")).toContain("remediation_excluded");
    expect(writer.validationByUnitId.get(r3.unit_id)?.status).toBe("removed");

    // 4: quote not in its own context → unbound → review, never supported.
    expect(r4.verification_state).toBe("unverified");
    expect(r4.evidence_binding).toBe("unbound");
    expect(r4.outcome).toBe("review");
    expect(r4.reasons.join(" ")).toContain("evidence_unbound");

    // Claim versions written through the Stage 3.2 machinery.
    expect(writer.claimVersions).toHaveLength(4);
    for (const v of writer.claimVersions) {
      expect(v.versionNo).toBe(1);
      expect(v.claimKey).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(body.results.every((r) => r.claim_key)).toBe(true);

    // Judgments are appended for every observation (audit history).
    expect(writer.judgments).toHaveLength(4);

    // Excluded observations are not embedded; surviving ones are.
    expect(writer.embedded).toHaveLength(3);
    expect(writer.embedded).not.toContain(r3.unit_id);

    expect(body.summary).toEqual({
      supported: 1,
      inferred: 0,
      unverified: 2,
      excluded: 1,
      embedded: 3,
    });
  });

  it("never sends evidence-less or unbound observations to the judge or remediation", async () => {
    const writer = new FakeGraphWriter();
    const validationGenerate = makeValidationGenerate();
    const remediationGenerate = makeRemediationGenerate();
    const deps = makeDeps(writer, { validationGenerate, remediationGenerate });

    await executeConnectMemoryWrite({
      auth: AUTH,
      keyId: null,
      observations: [OBS_NO_EVIDENCE, OBS_UNBOUND],
      requestId: "req-2",
      deps,
    });

    // No bound spans at all → zero judge calls, zero remediation calls (abstentions
    // are review-queue items, never remediation inputs).
    expect(validationGenerate).not.toHaveBeenCalled();
    expect(remediationGenerate).not.toHaveBeenCalled();
  });

  it("reports embedding degradation as a warning, not a failure", async () => {
    const writer = new FakeGraphWriter();
    const deps = makeDeps(writer, {
      embed: async () => {
        throw new Error("embedding provider down");
      },
    });
    const outcome = await executeConnectMemoryWrite({
      auth: AUTH,
      keyId: "key-abc",
      observations: [OBS_SUPPORTED],
      requestId: "req-3",
      deps,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.body.summary.embedded).toBe(0);
    expect(outcome.body.warnings?.join(" ")).toContain("embedding_degraded");
    // The claim itself still landed supported — embedding is an amenity, not a gate.
    expect(outcome.body.results[0].verification_state).toBe("supported");
  });

  it("fails closed with a 502 when the store write blows up mid-pipeline", async () => {
    const writer = new FakeGraphWriter();
    writer.writeUnitsAndRelations = async () => {
      throw new Error("store unreachable");
    };
    const outcome = await executeConnectMemoryWrite({
      auth: AUTH,
      keyId: "key-abc",
      observations: [OBS_SUPPORTED],
      requestId: "req-4",
      deps: makeDeps(writer),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.status).toBe(502);
    expect(outcome.body.error).toBe("memory_write_failed");
  });

  it("uses stable per-observation local ids", () => {
    expect(observationLocalId(0)).toBe("obs1");
    expect(observationLocalId(9)).toBe("obs10");
  });
});
