/**
 * Stage 3.2 — incremental re-ingest acceptance tests against the FULL runner
 * (docs/decisions/verified-memory-incremental-ingest.md §3, roadmap Stage 3.2):
 *
 *   1. first-time ingest behaves exactly as before (claims at version 1, judged once);
 *   2. re-ingest of an UNCHANGED source is a near-no-op — ZERO extraction/validation/
 *      grouping generate calls, zero writes beyond the last_seen_at touch (asserted by
 *      call counts on every port);
 *   3. re-ingest of a CHANGED source re-judges only changed/new claims, carries the
 *      verification state of unchanged claims forward, and supersedes removed claims
 *      reversibly with an intact provenance chain (superseded_by links resolve).
 *
 * Everything runs against an in-memory GraphWriter + counting generate stubs — no DB,
 * no LLM keys. Unit-record id shapes are opaque here (cohort invariant untouched).
 */
import { describe, expect, it, vi } from "vitest";
import { buildSupersessionTrace } from "@restormel/connect-core";
import type {
  ClaimVerificationState,
  PriorClaimVersion,
} from "@restormel/connect-core";
import type {
  ClaimVersionBinding,
  GraphWriter,
  StoredUnit,
} from "$lib/server/connect/graph-writer";
import type { StageGenerates } from "$lib/server/connect/ingest-full-runner";

vi.mock("$lib/server/neon", () => ({
  // resolveDomainPack: any truthy record — domainPackRecordToApi below is mocked.
  getConnectDomainPackById: vi.fn(async () => ({ record: true })),
  listConnectDomainPacksForWorkspace: vi.fn(async () => []),
  getConnectGraphTargetForWorkspace: vi.fn(async () => null),
  insertConnectGraphSourcePostgres: vi.fn(async () => "src-x"),
}));

vi.mock("$lib/server/connect/domain-pack-service", async () => {
  const { ConnectDomainPackSchema, DEFAULT_GENERIC_DOMAIN_PACK } = await import(
    "@restormel/contracts/connect"
  );
  const pack = ConnectDomainPackSchema.parse({
    id: "11111111-1111-4111-8111-111111111111",
    workspace_id: "22222222-2222-4222-8222-222222222222",
    ...DEFAULT_GENERIC_DOMAIN_PACK,
    // Starter preset: gates warn instead of block — the test exercises re-ingest
    // mechanics, not extraction-gate thresholds.
    quality_preset: "starter",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
  });
  return { domainPackRecordToApi: () => pack };
});

vi.mock("$lib/server/connect/graph-ingest-context", () => ({
  loadGraphIngestContext: async () => ({
    unitCount: 0,
    topUnitTypes: [],
    relationCount: 0,
    isGreenfield: true,
  }),
}));

// ── In-memory GraphWriter ─────────────────────────────────────────────────────

type FakeClaimVersion = {
  id: string;
  unitId: string;
  claimKey: string | null;
  versionNo: number;
  text: string;
  sourceHash: string | null;
  verificationState: string;
  judgedBy: string | null;
  judgedAt: string | null;
  validTo: string | null;
  supersededBy: string | null;
};

class FakeGraphWriter implements GraphWriter {
  readonly provider = "postgres" as const;
  sources: {
    id: string;
    sourceKey: string | null;
    contentHash: string | null;
    // P2a: the full text + BYO-origin flag the runner threads to the writer.
    text: string | null;
    originatesFromUserGraph: boolean;
  }[] = [];
  units: { id: string; sourceId: string; text: string }[] = [];
  claimVersions: FakeClaimVersion[] = [];
  validationByUnitId = new Map<string, { status: string; note: string | null }>();
  calls = { writeSource: 0, touchSourceSeen: 0, setEvidence: 0, supersede: 0 };
  private seq = 0;

  async writeSource(s: {
    sourceKey?: string | null;
    contentHash?: string | null;
    text?: string | null;
    originatesFromUserGraph?: boolean;
  }) {
    this.calls.writeSource += 1;
    const id = `src-${++this.seq}`;
    this.sources.push({
      id,
      sourceKey: s.sourceKey ?? null,
      contentHash: s.contentHash ?? null,
      text: s.text ?? null,
      originatesFromUserGraph: s.originatesFromUserGraph === true,
    });
    return id;
  }

  async findSourceVersion(sourceKey: string) {
    const row = [...this.sources].reverse().find((s) => s.sourceKey === sourceKey);
    return row ? { sourceId: row.id, contentHash: row.contentHash } : null;
  }

  async touchSourceSeen() {
    this.calls.touchSourceSeen += 1;
  }

  async listCurrentClaimVersions(sourceKey: string): Promise<PriorClaimVersion[]> {
    const sourceIds = new Set(
      this.sources.filter((s) => s.sourceKey === sourceKey).map((s) => s.id),
    );
    const unitIds = new Set(this.units.filter((u) => sourceIds.has(u.sourceId)).map((u) => u.id));
    return this.claimVersions
      .filter((v) => v.validTo == null && unitIds.has(v.unitId))
      .map((v) => ({
        versionId: v.id,
        claimKey: v.claimKey,
        versionNo: v.versionNo,
        unitId: v.unitId,
        text: v.text,
        verificationState: v.verificationState,
        judgedBy: v.judgedBy,
        judgedAt: v.judgedAt,
        validationStatus: this.validationByUnitId.get(v.unitId)?.status ?? null,
        validationNote: this.validationByUnitId.get(v.unitId)?.note ?? null,
      }));
  }

  async supersedeClaimVersions(rows: { versionId: string; supersededBy: string | null }[]) {
    this.calls.supersede += 1;
    let persisted = 0;
    for (const r of rows) {
      const v = this.claimVersions.find((c) => c.id === r.versionId && c.validTo == null);
      if (!v) continue;
      v.validTo = new Date().toISOString();
      v.supersededBy = r.supersededBy;
      persisted += 1;
    }
    return { persisted, missed: rows.length - persisted };
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
    return pairs.length;
  }

  async setValidation(results: { unitId: string; status: string; note: string | null }[]) {
    for (const r of results) {
      this.validationByUnitId.set(r.unitId, { status: r.status, note: r.note });
    }
    return results.length;
  }

  async setEvidence(args: { sourceHash: string; bindings: ClaimVersionBinding[] }) {
    this.calls.setEvidence += 1;
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
        judgedBy: b.carried?.judgedBy ?? null,
        judgedAt: b.carried?.judgedAt ?? null,
        validTo: null,
        supersededBy: null,
      });
      versionIdByUnitId.set(b.unitId, id);
    }
    return { persisted: args.bindings.length, missed: 0, versionIdByUnitId };
  }

  async setVerificationStates(
    states: { unitId: string; state: ClaimVerificationState; judgedBy?: string | null }[],
  ) {
    // Mirrors updateConnectClaimVersionStatesPostgres: update CURRENT version rows.
    for (const s of states) {
      for (const v of this.claimVersions) {
        if (v.unitId !== s.unitId || v.validTo != null) continue;
        v.verificationState = s.state;
        v.judgedBy = s.judgedBy ?? null;
        v.judgedAt = new Date().toISOString();
      }
    }
    return { persisted: states.length, missed: 0 };
  }

  async recordJudgments(rows: unknown[]) {
    return { persisted: rows.length, missed: 0 };
  }

  async updateUnitText() {}
  async deleteUnit() {}
  async excludeUnit(unitId: string, note: string) {
    this.validationByUnitId.set(unitId, { status: "removed", note });
  }
}

// ── Counting generate stubs (no LLM keys) ─────────────────────────────────────

const DOC_V1 =
  "Bentham founded classical utilitarianism. Mill ranked higher pleasures above lower ones. " +
  "Kant wrote the groundwork.";
const DOC_V2 =
  "Bentham founded classical utilitarianism. Mill ranked higher pleasures above lower ones. " +
  "Sidgwick systematised the doctrine.";

const EXTRACTION_V1 = JSON.stringify({
  units: [
    {
      id: "u1",
      text: "Bentham founded classical utilitarianism.",
      type: "assertion",
      evidence: "Bentham founded classical utilitarianism.",
    },
    {
      id: "u2",
      text: "Mill ranked higher pleasures above lower bodily pleasures.",
      type: "assertion",
      evidence: "Mill ranked higher pleasures above lower ones.",
    },
    {
      id: "u3",
      text: "Kant wrote the groundwork of the metaphysics of morals.",
      type: "assertion",
      evidence: "Kant wrote the groundwork.",
    },
  ],
  relations: [
    { from: "u1", relation: "relates_to", to: "u2" },
    { from: "u2", relation: "relates_to", to: "u3" },
  ],
});

// V2: u1 carried (same text + same quote), u2 changed (same quote, new claim text),
// u3 removed, u4 added.
const EXTRACTION_V2 = JSON.stringify({
  units: [
    {
      id: "u1",
      text: "Bentham founded classical utilitarianism.",
      type: "assertion",
      evidence: "Bentham founded classical utilitarianism.",
    },
    {
      id: "u2",
      text: "Mill ranked the higher pleasures strictly above the lower.",
      type: "assertion",
      evidence: "Mill ranked higher pleasures above lower ones.",
    },
    {
      id: "u4",
      text: "Sidgwick systematised utilitarian doctrine.",
      type: "assertion",
      evidence: "Sidgwick systematised the doctrine.",
    },
  ],
  relations: [
    { from: "u1", relation: "relates_to", to: "u2" },
    { from: "u2", relation: "relates_to", to: "u4" },
  ],
});

function buildGenerates() {
  const judgedRefsPerCall: string[][] = [];
  const extraction = vi.fn(async ({ user }: { system: string; user: string }) =>
    user.includes("Kant wrote") ? EXTRACTION_V1 : EXTRACTION_V2,
  );
  const validation = vi.fn(async ({ user }: { system: string; user: string }) => {
    const refs = [...user.matchAll(/CLAIM (\S+):/g)].map((m) => m[1]!);
    judgedRefsPerCall.push(refs);
    return JSON.stringify({
      results: refs.map((ref) => ({ ref, verdict: "entailed", confidence: 0.9 })),
    });
  });
  const grouping = vi.fn(async () => JSON.stringify({ groups: [] }));
  const remediation = vi.fn(async () => JSON.stringify({ results: [] }));
  const generates: StageGenerates = { extraction, grouping, validation, remediation };
  return { generates, extraction, validation, grouping, remediation, judgedRefsPerCall };
}

function jobWith(text: string) {
  return {
    id: "job-1",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    projectId: null,
    status: "pending",
    label: null,
    currentStage: null,
    currentAction: null,
    progress: null,
    stages: [],
    sources: [{ title: "Utilitarianism notes", url: "https://example.com/util", text }],
    stopAfterStage: null,
    pipelineProfileId: null,
    domainPackId: "pack-1",
    graphTargetId: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // Returned as a plain object so callers can spread it (e.g. jobWithSources);
    // the runner reads only the fields above, so call sites cast to the job type.
  };
}

async function run(writer: FakeGraphWriter, text: string) {
  const ports = buildGenerates();
  const { runFullExtraction } = await import("./ingest-full-runner");
  const result = await runFullExtraction({
    job: jobWith(text) as never,
    writer,
    generates: ports.generates,
    validationModelId: "judge#test",
  });
  return { result, ports };
}

describe("runFullExtraction — Stage 3.2 incremental re-ingest", () => {
  it("first-time ingest: version-1 claims, every unit judged once (behavior unchanged)", async () => {
    const writer = new FakeGraphWriter();
    const { result, ports } = await run(writer, DOC_V1);

    expect(result.units).toBe(3);
    expect(result.reingest).toEqual({
      unchangedSources: 0,
      carriedClaims: 0,
      changedClaims: 0,
      removedClaims: 0,
    });
    expect(ports.extraction).toHaveBeenCalledTimes(1);
    // All three claims judged (one entailment batch).
    expect(ports.judgedRefsPerCall.flat()).toHaveLength(3);
    expect(writer.claimVersions).toHaveLength(3);
    expect(writer.claimVersions.every((v) => v.versionNo === 1 && v.validTo == null)).toBe(true);
    expect(writer.claimVersions.every((v) => v.claimKey)).toBe(true);
    expect(writer.claimVersions.every((v) => v.verificationState === "supported")).toBe(true);
  });

  it("UNCHANGED source: near-no-op — zero generate calls, only a last_seen_at touch", async () => {
    const writer = new FakeGraphWriter();
    await run(writer, DOC_V1);
    const before = {
      sources: writer.sources.length,
      units: writer.units.length,
      versions: JSON.stringify(writer.claimVersions),
    };

    const { result, ports } = await run(writer, DOC_V1);

    // THE acceptance assertion: zero model calls of any kind.
    expect(ports.extraction).toHaveBeenCalledTimes(0);
    expect(ports.validation).toHaveBeenCalledTimes(0);
    expect(ports.grouping).toHaveBeenCalledTimes(0);
    expect(ports.remediation).toHaveBeenCalledTimes(0);
    // Zero writes beyond the touch.
    expect(writer.calls.touchSourceSeen).toBe(1);
    expect(writer.sources).toHaveLength(before.sources);
    expect(writer.units).toHaveLength(before.units);
    expect(JSON.stringify(writer.claimVersions)).toBe(before.versions);
    expect(result.units).toBe(0);
    expect(result.reingest.unchangedSources).toBe(1);
  });

  it("CHANGED source: carries unchanged claims (no re-judging), re-judges only changed/new, supersedes removed with an intact chain", async () => {
    const writer = new FakeGraphWriter();
    const first = await run(writer, DOC_V1);
    const v1Units = writer.units.map((u) => u.id);
    const benthamKey = writer.claimVersions.find((v) =>
      v.text.startsWith("Bentham"),
    )!.claimKey!;
    const kantKey = writer.claimVersions.find((v) => v.text.startsWith("Kant"))!.claimKey!;
    const judgedAtV1 = writer.claimVersions.find((v) => v.claimKey === benthamKey)!.judgedAt;

    const { result, ports } = await run(writer, DOC_V2);

    expect(result.reingest).toEqual({
      unchangedSources: 0,
      carriedClaims: 1,
      changedClaims: 1,
      removedClaims: 1,
    });

    // Extraction runs for the changed document (O(changed documents), not O(graph))…
    expect(ports.extraction).toHaveBeenCalledTimes(1);
    // …but the judge sees ONLY the changed + new claims — the carried claim is never re-judged.
    const judgedUnitIds = new Set(ports.judgedRefsPerCall.flat());
    expect(judgedUnitIds.size).toBe(2);
    const benthamV2 = writer.claimVersions.find(
      (v) => v.claimKey === benthamKey && v.validTo == null,
    )!;
    expect(judgedUnitIds.has(benthamV2.unitId)).toBe(false);

    // Carried claim: version 2, verification state + judge attribution copied forward.
    expect(benthamV2.versionNo).toBe(2);
    expect(benthamV2.verificationState).toBe("supported");
    expect(benthamV2.judgedAt).toBe(judgedAtV1);

    // Provenance: the carried claim's chain is v1 → v2 and intact.
    const benthamTrace = buildSupersessionTrace(
      writer.claimVersions
        .filter((v) => v.claimKey === benthamKey)
        .map((v) => ({
          versionId: v.id,
          versionNo: v.versionNo,
          unitId: v.unitId,
          text: v.text,
          verificationState: v.verificationState,
          sourceHash: v.sourceHash,
          validFrom: null,
          validTo: v.validTo,
          supersededBy: v.supersededBy,
        })),
    );
    expect(benthamTrace.chain.map((r) => r.versionNo)).toEqual([1, 2]);
    expect(benthamTrace.current?.versionId).toBe(benthamV2.id);
    expect(benthamTrace.intact).toBe(true);

    // Removed claim: superseded (valid_to closed, no successor) — never orphaned or kept.
    const kantVersions = writer.claimVersions.filter((v) => v.claimKey === kantKey);
    expect(kantVersions).toHaveLength(1);
    expect(kantVersions[0]!.validTo).not.toBeNull();
    expect(kantVersions[0]!.supersededBy).toBeNull();

    // Every prior unit record was soft-excluded (reversible), never deleted.
    for (const unitId of v1Units) {
      const validation = writer.validationByUnitId.get(unitId);
      expect(validation?.status).toBe("removed");
      expect(validation?.note).toContain("Superseded (re-ingest)");
    }
    expect(writer.units.map((u) => u.id)).toEqual(expect.arrayContaining(v1Units));

    // Exactly one current version per surviving claim; first run's totals unchanged.
    expect(first.result.units).toBe(3);
    const current = writer.claimVersions.filter((v) => v.validTo == null);
    expect(current).toHaveLength(3);
  });
});

// ── P2a: full text threaded to writer.writeSource (BYO source-of-truth) ─────────

function jobWithSources(sources: unknown[]) {
  return { ...jobWith("ignored"), sources } as never;
}

async function runJob(writer: FakeGraphWriter, job: unknown) {
  const ports = buildGenerates();
  const { runFullExtraction } = await import("./ingest-full-runner");
  const result = await runFullExtraction({
    job: job as never,
    writer,
    generates: ports.generates,
    validationModelId: "judge#test",
  });
  return { result, ports };
}

describe("runFullExtraction — P2a source text to the user's store", () => {
  it("threads the FULL parsed text (byte-exact) to writer.writeSource for a normal source", async () => {
    const writer = new FakeGraphWriter();
    await runJob(
      writer,
      jobWithSources([{ title: "Notes", url: "https://example.com/util", text: DOC_V1 }]),
    );
    expect(writer.sources).toHaveLength(1);
    // Byte-exact: the runner passes src.text VERBATIM — the same bytes evidence binds against.
    expect(writer.sources[0]!.text).toBe(DOC_V1);
    expect(writer.sources[0]!.originatesFromUserGraph).toBe(false);
  });

  it("flags originatesFromUserGraph when the source carries a graph_source_key (BYO double-write guard)", async () => {
    const writer = new FakeGraphWriter();
    await runJob(
      writer,
      jobWithSources([
        {
          title: "Imported from my graph",
          text: DOC_V1,
          provenance: { graph_source_key: "source:abc123" },
        },
      ]),
    );
    expect(writer.sources).toHaveLength(1);
    expect(writer.sources[0]!.originatesFromUserGraph).toBe(true);
    // Text is still threaded (Postgres ignores it; Surreal writer is the one that skips it).
    expect(writer.sources[0]!.text).toBe(DOC_V1);
  });
});
