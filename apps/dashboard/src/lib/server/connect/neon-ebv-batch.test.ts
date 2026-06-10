/**
 * EBV persistence batching (Stage 1.5 perf review): the per-row INSERT/UPDATE loops
 * cost one Neon HTTP round-trip per unit; these tests pin the batched shape — exactly
 * ONE statement per call regardless of row count, with array (unnest) parameters.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Captured = { text: string; params: unknown[] };
const captured: Captured[] = [];

vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
      captured.push({ text: strings.join("$"), params: values });
      return Promise.resolve([]);
    };
    return tag;
  },
}));

process.env.DATABASE_URL = "postgres://test:test@localhost/test";

// $env/dynamic/private snapshots at vite startup in tests — point it at process.env.
vi.mock("$env/dynamic/private", () => ({ env: process.env }));

function callsMatching(snippet: string): Captured[] {
  return captured.filter((c) => c.text.includes(snippet));
}

describe("EBV Postgres persistence is batched (one round-trip per call)", () => {
  beforeEach(() => {
    captured.length = 0;
  });

  it("insertConnectClaimVersionsPostgres issues a single multi-row INSERT", async () => {
    const { insertConnectClaimVersionsPostgres } = await import("$lib/server/neon");
    const rows = ["u1", "u2", "u3"].map((unitId) => ({
      unitId,
      text: `claim ${unitId}`,
      evidenceQuote: "quote",
      spanStart: 0,
      spanEnd: 5,
      evidenceMatch: "exact",
      evidenceStatus: "bound" as const,
      sourceHash: "hash",
    }));
    const n = await insertConnectClaimVersionsPostgres({ workspaceId: "ws", rows });
    expect(n).toBe(3);
    const inserts = callsMatching("INSERT INTO connect_claim_versions");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.text).toContain("unnest(");
    expect(inserts[0]!.params).toContainEqual(["u1", "u2", "u3"]);
  });

  it("updateConnectClaimVersionStatesPostgres issues a single multi-row UPDATE", async () => {
    const { updateConnectClaimVersionStatesPostgres } = await import("$lib/server/neon");
    const n = await updateConnectClaimVersionStatesPostgres({
      workspaceId: "ws",
      states: [
        { unitId: "u1", state: "supported", judgedBy: "m#pv1" },
        { unitId: "u2", state: "unverified" },
      ],
    });
    expect(n).toBe(2);
    const updates = callsMatching("UPDATE connect_claim_versions");
    expect(updates).toHaveLength(1);
    expect(updates[0]!.text).toContain("unnest(");
    expect(updates[0]!.text).toContain("valid_to IS NULL");
    expect(updates[0]!.params).toContainEqual(["u1", "u2"]);
    expect(updates[0]!.params).toContainEqual(["m#pv1", null]);
  });

  it("insertConnectClaimJudgmentsPostgres issues a single multi-row INSERT", async () => {
    const { insertConnectClaimJudgmentsPostgres } = await import("$lib/server/neon");
    const judgedAt = new Date().toISOString();
    const n = await insertConnectClaimJudgmentsPostgres({
      workspaceId: "ws",
      rows: ["u1", "u2"].map((unitId) => ({
        unitId,
        verdict: "entailed",
        confidence: 0.9,
        note: null,
        judgeModel: "judge-1",
        promptVersion: 1,
        judgedAt,
      })),
    });
    expect(n).toBe(2);
    const inserts = callsMatching("INSERT INTO connect_claim_judgments");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.text).toContain("unnest(");
    expect(inserts[0]!.params).toContainEqual(["u1", "u2"]);
  });

  it("updateUnitValidationPostgres issues a single multi-row UPDATE", async () => {
    const { updateUnitValidationPostgres } = await import("$lib/server/neon");
    const n = await updateUnitValidationPostgres({
      workspaceId: "ws",
      results: [
        { unitId: "u1", status: "ok", note: null },
        { unitId: "u2", status: "weak", note: "thin evidence" },
        { unitId: "u3", status: "unsupported" },
      ],
    });
    expect(n).toBe(3);
    const updates = captured.filter(
      (c) => c.text.includes("UPDATE knowledge_graph_units") && c.text.includes("validation_status"),
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]!.text).toContain("unnest(");
    expect(updates[0]!.params).toContainEqual(["u1", "u2", "u3"]);
    expect(updates[0]!.params).toContainEqual([null, "thin evidence", null]);
  });

  it("updateUnitEmbeddingsPostgres batches vectors instead of one UPDATE per unit", async () => {
    const { updateUnitEmbeddingsPostgres } = await import("$lib/server/neon");
    const n = await updateUnitEmbeddingsPostgres({
      workspaceId: "ws",
      embeddings: [
        { unitId: "u1", vector: [0.1, 0.2] },
        { unitId: "u2", vector: [0.3, 0.4] },
      ],
    });
    expect(n).toBe(2);
    const updates = captured.filter(
      (c) => c.text.includes("UPDATE knowledge_graph_units") && c.text.includes("embedding"),
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]!.params).toContainEqual(["u1", "u2"]);
  });

  it("no-ops without a round-trip on empty input", async () => {
    const neon = await import("$lib/server/neon");
    captured.length = 0;
    expect(await neon.insertConnectClaimVersionsPostgres({ workspaceId: "ws", rows: [] })).toBe(0);
    expect(
      await neon.updateConnectClaimVersionStatesPostgres({ workspaceId: "ws", states: [] }),
    ).toBe(0);
    expect(await neon.insertConnectClaimJudgmentsPostgres({ workspaceId: "ws", rows: [] })).toBe(0);
    expect(await neon.updateUnitValidationPostgres({ workspaceId: "ws", results: [] })).toBe(0);
    expect(await neon.updateUnitEmbeddingsPostgres({ workspaceId: "ws", embeddings: [] })).toBe(0);
    expect(captured).toHaveLength(0);
  });
});
