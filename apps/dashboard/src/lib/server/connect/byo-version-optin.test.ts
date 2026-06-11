/**
 * Stage 3.2b — BYO Surreal incremental re-ingest: user-controlled opt-in version table.
 *
 * Acceptance tests (roadmap Stage 3.2b contract):
 *
 * OFF path (default):
 *   - writer.allowSurrealVersionTable is false
 *   - findSourceVersion() returns null — no DDL fired
 *   - listCurrentClaimVersions() returns []
 *   - supersedeClaimVersions() returns missed = rows.length
 *   - setEvidence() writes unit fields but no restormel_claim_versions rows
 *   - versionIdByUnitId map is empty
 *
 * ON path (setting = true, DDL succeeds):
 *   - writer.allowSurrealVersionTable is true
 *   - probeVersionTable() returns true and fires DDL exactly once
 *   - findSourceVersion() queries the source table
 *   - setEvidence() writes restormel_claim_versions rows and populates versionIdByUnitId
 *   - listCurrentClaimVersions() returns persisted rows
 *   - supersedeClaimVersions() closes validity windows
 *   - unit-id shapes are never mutated (cohort invariant)
 *   - carry-forward sets verification_state in version rows
 *
 * Table creation failure (setting = true, DDL rejects):
 *   - probeVersionTable() returns false + emits ONE operator-visible warning
 *   - findSourceVersion() returns null after DDL failure
 *   - setEvidence() writes unit fields but NO version rows
 *   - versionIdByUnitId map is empty
 *   - warning is emitted at most once per writer instance
 */
import { describe, expect, it, vi } from "vitest";
import { ConnectDomainPackSchema, DEFAULT_GENERIC_DOMAIN_PACK } from "@restormel/contracts/connect";
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { ClaimVersionBinding } from "./graph-writer";

// ── Shared helpers ────────────────────────────────────────────────────────────

function makePack(): ConnectDomainPack {
  return ConnectDomainPackSchema.parse({
    id: "11111111-1111-4111-8111-111111111111",
    workspace_id: "22222222-2222-4222-8222-222222222222",
    ...DEFAULT_GENERIC_DOMAIN_PACK,
    quality_preset: "starter",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });
}

function makeBinding(unitId: string, claimKey = "ck:test"): ClaimVersionBinding {
  return {
    unitId,
    text: "Test claim.",
    claimKey,
    versionNo: 1,
    binding: {
      status: "bound",
      span: { quote: "Test claim.", start: 0, end: 11, source_hash: "sha:test", match: "exact" },
    },
  };
}

type QueryCall = { sql: string };

class FakeStore {
  calls: QueryCall[] = [];
  responseMap: Map<string, unknown> = new Map();
  errors: Map<string, Error> = new Map();
  isDatabaseUnavailable = () => false;

  async query<T>(sql: string): Promise<T> {
    this.calls.push({ sql });
    for (const [prefix, err] of this.errors) {
      if (sql.includes(prefix)) throw err;
    }
    for (const [prefix, res] of this.responseMap) {
      if (sql.includes(prefix)) return res as T;
    }
    return [] as T;
  }
}

type ConnectGraphTargetRecord = {
  id: string;
  workspaceId: string;
  label: string | null;
  provider: string;
  endpoint: string | null;
  namespace: string | null;
  database: string | null;
  username: string | null;
  useDashboardDatabase: boolean;
  defaultDomainPackId: string | null;
  settings: Record<string, unknown>;
  secretCiphertext: string | null;
  secretIv: string | null;
  secretAuthTag: string | null;
  secretEncryptionVersion: number;
  status: string;
  lastTestedAt: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
};

function makeTarget(allow: boolean): ConnectGraphTargetRecord {
  return {
    id: "tgt-1",
    workspaceId: "ws-1",
    label: "test",
    provider: "surreal",
    endpoint: "https://db.example.com",
    namespace: "ns",
    database: "db",
    username: null,
    useDashboardDatabase: false,
    defaultDomainPackId: null,
    settings: { allow_claim_versions_table: allow },
    secretCiphertext: null,
    secretIv: null,
    secretAuthTag: null,
    secretEncryptionVersion: 0,
    status: "ok",
    lastTestedAt: null,
    lastError: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Build a SurrealGraphWriter by directly calling the module-level factory, with
 * `buildWorkspaceGraphStore` stubbed so we can inject a FakeStore.
 */
async function buildWriter(store: FakeStore, opts: { allowVersionTable: boolean }) {
  // We use vi.doMock to provide the store. vi.resetModules() ensures fresh imports.
  vi.resetModules();
  vi.doMock("$lib/server/connect/surreal-graph-store", () => ({
    buildWorkspaceGraphStore: async () => store,
  }));
  const { buildGraphWriter } = await import("./graph-writer");
  const writer = await buildGraphWriter(
    makeTarget(opts.allowVersionTable) as never,
    makePack(),
    { workspaceId: "ws-1", domainPackId: null, id: "job-1" },
  );
  return writer;
}

// ── OFF path ─────────────────────────────────────────────────────────────────

describe("SurrealGraphWriter — OFF path (allow_claim_versions_table = false)", () => {
  it("allowSurrealVersionTable is false", async () => {
    const store = new FakeStore();
    const writer = await buildWriter(store, { allowVersionTable: false });
    expect(writer).not.toBeNull();
    expect(writer!.allowSurrealVersionTable).toBe(false);
  });

  it("findSourceVersion returns null and fires no DDL", async () => {
    const store = new FakeStore();
    const writer = await buildWriter(store, { allowVersionTable: false });
    const result = await writer!.findSourceVersion("url:https://example.com");
    expect(result).toBeNull();
    expect(store.calls.some((c) => c.sql.includes("restormel_claim_versions"))).toBe(false);
  });

  it("listCurrentClaimVersions returns []", async () => {
    const store = new FakeStore();
    const writer = await buildWriter(store, { allowVersionTable: false });
    const result = await writer!.listCurrentClaimVersions("url:https://example.com");
    expect(result).toEqual([]);
  });

  it("supersedeClaimVersions reports all rows as missed", async () => {
    const store = new FakeStore();
    const writer = await buildWriter(store, { allowVersionTable: false });
    const result = await writer!.supersedeClaimVersions([
      { versionId: "restormel_claim_versions:abc", supersededBy: null },
      { versionId: "restormel_claim_versions:def", supersededBy: "restormel_claim_versions:ghi" },
    ]);
    expect(result).toEqual({ persisted: 0, missed: 2 });
  });

  it("setEvidence writes unit fields, NO version rows, versionIdByUnitId empty", async () => {
    const store = new FakeStore();
    store.responseMap.set("UPDATE", [{ evidence_status: "bound" }]);
    const writer = await buildWriter(store, { allowVersionTable: false });
    const result = await writer!.setEvidence({
      sourceHash: "sha:abc",
      bindings: [makeBinding("unit:u1")],
    });
    expect(result.persisted).toBe(1);
    expect(result.missed).toBe(0);
    expect(result.versionIdByUnitId.size).toBe(0);
    expect(store.calls.some((c) => c.sql.includes("restormel_claim_versions"))).toBe(false);
  });

  it("probeVersionTable returns false without any DDL", async () => {
    const store = new FakeStore();
    const writer = await buildWriter(store, { allowVersionTable: false });
    const ready = await writer!.probeVersionTable?.();
    expect(ready).toBe(false);
    expect(store.calls.some((c) => c.sql.includes("DEFINE TABLE"))).toBe(false);
  });
});

// ── ON path ──────────────────────────────────────────────────────────────────

describe("SurrealGraphWriter — ON path (allow_claim_versions_table = true, DDL succeeds)", () => {
  function makeOnStore(): FakeStore {
    const store = new FakeStore();
    store.responseMap.set("DEFINE TABLE", []);
    store.responseMap.set("SELECT id, content_hash FROM source", [
      { id: "source:s1", content_hash: "sha:v1" },
    ]);
    store.responseMap.set("SELECT * FROM restormel_claim_versions", [
      {
        id: "restormel_claim_versions:v1",
        unit_id: "unit:u1",
        claim_key: "ck:test",
        version_no: 1,
        text: "Test claim.",
        verification_state: "supported",
        judged_by: "judge#1",
        judged_at: "2026-06-01T00:00:00.000Z",
        valid_to: null,
        source_key: "url:https://example.com",
      },
    ]);
    store.responseMap.set("CREATE restormel_claim_versions", [
      { id: "restormel_claim_versions:v2" },
    ]);
    store.responseMap.set("UPDATE unit", [{ evidence_status: "bound" }]);
    return store;
  }

  it("allowSurrealVersionTable is true", async () => {
    const writer = await buildWriter(makeOnStore(), { allowVersionTable: true });
    expect(writer!.allowSurrealVersionTable).toBe(true);
  });

  it("probeVersionTable returns true and fires DDL exactly once", async () => {
    const store = makeOnStore();
    const writer = await buildWriter(store, { allowVersionTable: true });
    const ready1 = await writer!.probeVersionTable?.();
    const ready2 = await writer!.probeVersionTable?.();
    expect(ready1).toBe(true);
    expect(ready2).toBe(true);
    const ddlCalls = store.calls.filter((c) => c.sql.includes("DEFINE TABLE"));
    expect(ddlCalls).toHaveLength(1);
  });

  it("findSourceVersion returns sourceId + contentHash", async () => {
    const writer = await buildWriter(makeOnStore(), { allowVersionTable: true });
    const result = await writer!.findSourceVersion("url:https://example.com");
    expect(result).toMatchObject({ sourceId: "source:s1", contentHash: "sha:v1" });
  });

  it("findSourceVersion returns null when no source row found", async () => {
    const store = makeOnStore();
    store.responseMap.set("SELECT id, content_hash FROM source", []);
    const writer = await buildWriter(store, { allowVersionTable: true });
    const result = await writer!.findSourceVersion("url:https://example.com");
    expect(result).toBeNull();
  });

  it("listCurrentClaimVersions returns current rows as PriorClaimVersion", async () => {
    const writer = await buildWriter(makeOnStore(), { allowVersionTable: true });
    const rows = await writer!.listCurrentClaimVersions("url:https://example.com");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      versionId: "restormel_claim_versions:v1",
      unitId: "unit:u1",
      claimKey: "ck:test",
      verificationState: "supported",
    });
  });

  it("supersedeClaimVersions writes valid_to and superseded_by", async () => {
    const store = makeOnStore();
    store.responseMap.set("UPDATE restormel_claim_versions", []);
    const writer = await buildWriter(store, { allowVersionTable: true });
    const result = await writer!.supersedeClaimVersions([
      { versionId: "restormel_claim_versions:v1", supersededBy: "restormel_claim_versions:v2" },
    ]);
    expect(result.persisted).toBe(1);
    expect(result.missed).toBe(0);
    const upd = store.calls.find(
      (c) => c.sql.includes("UPDATE") && c.sql.includes("restormel_claim_versions:v1"),
    );
    expect(upd?.sql).toContain("valid_to");
    expect(upd?.sql).toContain("superseded_by");
  });

  it("setEvidence writes version rows and populates versionIdByUnitId", async () => {
    const store = makeOnStore();
    const writer = await buildWriter(store, { allowVersionTable: true });
    const result = await writer!.setEvidence({
      sourceHash: "sha:v2",
      bindings: [makeBinding("unit:u2", "ck:new")],
    });
    expect(result.persisted).toBe(1);
    expect(result.versionIdByUnitId.size).toBe(1);
    expect(result.versionIdByUnitId.get("unit:u2")).toBe("restormel_claim_versions:v2");
    const create = store.calls.find((c) => c.sql.includes("CREATE restormel_claim_versions"));
    expect(create?.sql).toContain('"claim_key":"ck:new"');
  });

  it("setEvidence with carry-forward copies verification_state into version row", async () => {
    const store = makeOnStore();
    const writer = await buildWriter(store, { allowVersionTable: true });
    const carriedBinding: ClaimVersionBinding = {
      ...makeBinding("unit:u3", "ck:carried"),
      versionNo: 2,
      carried: {
        verificationState: "supported",
        judgedBy: "judge#1",
        judgedAt: "2026-06-01T00:00:00.000Z",
      },
    };
    await writer!.setEvidence({ sourceHash: "sha:v2", bindings: [carriedBinding] });
    const create = store.calls.find(
      (c) => c.sql.includes("CREATE restormel_claim_versions") && c.sql.includes('"unit_id":"unit:u3"'),
    );
    expect(create?.sql).toContain('"verification_state":"supported"');
    expect(create?.sql).toContain('"judged_by":"judge#1"');
    expect(create?.sql).toContain('"version_no":2');
  });

  it("unit-id shapes are never mutated (cohort invariant)", async () => {
    const store = makeOnStore();
    // Override the UPDATE response for the specific unit id shape.
    store.responseMap.set("UPDATE", [{ evidence_status: "bound" }]);
    const writer = await buildWriter(store, { allowVersionTable: true });
    const unitId = "unit:⟨some-uuid⟩";
    await writer!.setEvidence({ sourceHash: "sha:v1", bindings: [makeBinding(unitId, "ck:x")] });
    // Unit record id must appear verbatim in the UPDATE call.
    const upd = store.calls.find((c) => c.sql.includes("UPDATE") && c.sql.includes(unitId));
    expect(upd).toBeTruthy();
    // And in the version row's unit_id field.
    const create = store.calls.find(
      (c) => c.sql.includes("CREATE restormel_claim_versions") && c.sql.includes(`"unit_id":"${unitId}"`),
    );
    expect(create).toBeTruthy();
  });
});

// ── Table creation failure ────────────────────────────────────────────────────

describe("SurrealGraphWriter — ON but DDL fails (permission error)", () => {
  function makeFailStore(): FakeStore {
    const store = new FakeStore();
    store.errors.set("DEFINE TABLE", new Error("IAM_PERMISSION_DENIED: CREATE TABLE not allowed"));
    store.responseMap.set("UPDATE", [{ evidence_status: "bound" }]);
    return store;
  }

  it("probeVersionTable returns false and emits an operator-visible warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const store = makeFailStore();
      const writer = await buildWriter(store, { allowVersionTable: true });
      const ready = await writer!.probeVersionTable?.();
      expect(ready).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Could not create"));
      expect(warnSpy.mock.calls[0]?.[0]).toContain("restormel_claim_versions");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("findSourceVersion returns null after DDL failure", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const store = makeFailStore();
      const writer = await buildWriter(store, { allowVersionTable: true });
      await writer!.probeVersionTable?.(); // trigger failure
      const result = await writer!.findSourceVersion("url:https://example.com");
      expect(result).toBeNull();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("setEvidence writes unit fields but NO version rows after DDL failure", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const store = makeFailStore();
      const writer = await buildWriter(store, { allowVersionTable: true });
      await writer!.probeVersionTable?.(); // trigger failure
      const result = await writer!.setEvidence({
        sourceHash: "sha:v1",
        bindings: [makeBinding("unit:u1")],
      });
      expect(result.persisted).toBe(1);
      expect(result.versionIdByUnitId.size).toBe(0);
      expect(store.calls.some((c) => c.sql.includes("CREATE restormel_claim_versions"))).toBe(false);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("warning is emitted at most once per writer instance (no log spam)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const store = makeFailStore();
      const writer = await buildWriter(store, { allowVersionTable: true });
      await writer!.probeVersionTable?.();
      await writer!.findSourceVersion("key");
      await writer!.listCurrentClaimVersions("key");
      // Only one warning about table creation per instance.
      const permissionWarns = warnSpy.mock.calls.filter((c: unknown[]) =>
        String(c[0]).includes("Could not create"),
      );
      expect(permissionWarns).toHaveLength(1);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
