import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the data-access layer so the export module is tested in isolation (no DB,
// no $env, no pg). Each mock RECORDS the scope id it was called with, so we can
// assert assembleAccountExport never reaches outside the requesting account.
// ---------------------------------------------------------------------------

const calls: Record<string, unknown[][]> = {};
function record(name: string) {
  return (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
    return Promise.resolve([]);
  };
}

vi.mock("$lib/server/neon", () => ({
  getWorkspace: vi.fn((...a: unknown[]) => {
    (calls.getWorkspace ??= []).push(a);
    return Promise.resolve({
      id: a[0],
      name: "Default",
      slug: "default",
      ownerUserId: "user-alice",
      createdAt: 1,
      plan: "free",
      planExpiresAt: null,
    });
  }),
  listProjectsByWorkspace: vi.fn((...a: unknown[]) => {
    (calls.listProjectsByWorkspace ??= []).push(a);
    // One project so the per-project fan-out (routes/env/bindings) is exercised.
    return Promise.resolve([
      { id: "proj-1", name: "P1", workspaceId: a[0], createdAt: 2, isRestormelTesting: false },
    ]);
  }),
  listEnvironments: vi.fn(record("listEnvironments")),
  listApiKeysByWorkspace: vi.fn(record("listApiKeysByWorkspace")),
  listManagementKeys: vi.fn(record("listManagementKeys")),
  listProviderIntegrations: vi.fn(record("listProviderIntegrations")),
  listPolicies: vi.fn(record("listPolicies")),
  listPolicyBindingsForWorkspace: vi.fn(record("listPolicyBindingsForWorkspace")),
  listRoutes: vi.fn(record("listRoutes")),
  listProjectModelBindings: vi.fn(record("listProjectModelBindings")),
  listProviderBindingsByProject: vi.fn(record("listProviderBindingsByProject")),
  listConnectGraphSourcesForWorkspace: vi.fn(record("listConnectGraphSourcesForWorkspace")),
  listConnectSourceDocumentsForWorkspace: vi.fn(record("listConnectSourceDocumentsForWorkspace")),
}));

vi.mock("$lib/server/connect/graph-store-config", () => ({
  getWorkspaceGraphStoreConfigForUi: vi.fn((...a: unknown[]) => {
    (calls.getWorkspaceGraphStoreConfigForUi ??= []).push(a);
    return Promise.resolve(null);
  }),
}));

vi.mock("$lib/server/email-preferences", () => ({
  getPreferencesForUser: vi.fn((...a: unknown[]) => {
    (calls.getPreferencesForUser ??= []).push(a);
    return Promise.resolve(null);
  }),
}));

import {
  buildGraphSpineSelects,
  GRAPH_SPINE_EXPORT_SELECTS,
  findForbiddenKey,
  assertNoSecretLeakage,
  assembleAccountExport,
  ACCOUNT_EXPORT_SCHEMA_VERSION,
  SECRET_EXCLUSION_NOTE,
  EXTERNAL_STORE_EXPORT_NOTE,
  FORBIDDEN_EXPORT_KEYS,
} from "./account-export";
import type { DbClient } from "./db-adapter";

const WS = "ws-OWNED-by-alice";
const UID = "user-alice";
const OTHER_WS = "ws-owned-by-mallory";
const OTHER_UID = "user-mallory";

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Pure graph-spine SELECTs — scoping correctness
// ---------------------------------------------------------------------------

describe("buildGraphSpineSelects — scoping", () => {
  const selects = buildGraphSpineSelects(WS);

  it("every spine SELECT carries WHERE workspace_id = $1 and binds ONLY the workspace", () => {
    expect(selects.length).toBe(GRAPH_SPINE_EXPORT_SELECTS.length);
    for (const s of selects) {
      expect(s.text).toMatch(/WHERE workspace_id = \$1/);
      expect(s.params).toEqual([WS]);
      expect(s.params).not.toContain(OTHER_WS);
    }
  });

  it("never selects the embedding vector (non-portable, derived, not exported)", () => {
    const allText = selects.map((s) => s.text).join("\n");
    expect(allText).not.toMatch(/\bembedding\b/);
  });

  it("only ever binds the requesting workspace id across all spine statements", () => {
    const params = selects.flatMap((s) => s.params);
    for (const p of params) expect(p).toBe(WS);
  });

  it("requires a workspaceId", () => {
    expect(() => buildGraphSpineSelects("")).toThrow(/workspaceId required/);
  });
});

// ---------------------------------------------------------------------------
// Secret-leakage guard
// ---------------------------------------------------------------------------

describe("findForbiddenKey / assertNoSecretLeakage", () => {
  it("returns null for a clean archive", () => {
    expect(findForbiddenKey({ a: 1, b: { c: [{ d: "ok" }] } })).toBeNull();
  });

  it.each(FORBIDDEN_EXPORT_KEYS)("flags forbidden key %s anywhere in the structure", (key) => {
    const offender = findForbiddenKey({ outer: { inner: [{ [key]: "secret" }] } });
    expect(offender).toContain(key);
  });

  it("assertNoSecretLeakage throws when a secret-shaped key is present", () => {
    expect(() => assertNoSecretLeakage({ keys: { gatewayKeys: [{ keyHash: "deadbeef" }] } })).toThrow(
      /forbidden secret-shaped key/,
    );
  });

  it("assertNoSecretLeakage is a no-op on a clean archive", () => {
    expect(() => assertNoSecretLeakage({ keys: { gatewayKeys: [{ keyPrefix: "rk_abc…" }] } })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// assembleAccountExport — end-to-end scoping + shape
// ---------------------------------------------------------------------------

function fakeSql(): { sql: DbClient; queries: { text: string; params: unknown[] }[] } {
  const queries: { text: string; params: unknown[] }[] = [];
  const query = (text: string, params: unknown[] = []) => {
    queries.push({ text, params });
    return Promise.resolve([] as Record<string, unknown>[]);
  };
  const sql = Object.assign(vi.fn(), { query, transaction: vi.fn() }) as unknown as DbClient;
  return { sql, queries };
}

describe("assembleAccountExport — account scoping", () => {
  it("passes ONLY the requesting workspaceId to every workspace-scoped reader", async () => {
    const { sql } = fakeSql();
    await assembleAccountExport(sql, { workspaceId: WS, userId: UID, email: "a@x.test" });

    const workspaceScopedReaders = [
      "getWorkspace",
      "listProjectsByWorkspace",
      "listApiKeysByWorkspace",
      "listManagementKeys",
      "listProviderIntegrations",
      "listPolicies",
      "listPolicyBindingsForWorkspace",
      "listConnectGraphSourcesForWorkspace",
      "listConnectSourceDocumentsForWorkspace",
      "getWorkspaceGraphStoreConfigForUi",
    ];
    for (const name of workspaceScopedReaders) {
      expect(calls[name], `${name} not called`).toBeTruthy();
      for (const argList of calls[name]) {
        expect(argList[0], `${name} got wrong workspace`).toBe(WS);
        expect(argList).not.toContain(OTHER_WS);
        expect(argList).not.toContain(OTHER_UID);
      }
    }
  });

  it("passes ONLY the requesting userId to user-scoped readers", async () => {
    const { sql } = fakeSql();
    await assembleAccountExport(sql, { workspaceId: WS, userId: UID, email: null });
    for (const argList of calls.getPreferencesForUser) {
      expect(argList[0]).toBe(UID);
      expect(argList).not.toContain(OTHER_UID);
    }
    // Per-project readers that take userId must get THIS user's id.
    for (const argList of calls.listEnvironments ?? []) expect(argList[1]).toBe(UID);
    for (const argList of calls.listRoutes ?? []) expect(argList[1]).toBe(UID);
  });

  it("runs the graph-spine SELECTs through the injected sql, each workspace-scoped", async () => {
    const { sql, queries } = fakeSql();
    await assembleAccountExport(sql, { workspaceId: WS, userId: UID, email: null });
    expect(queries.length).toBe(GRAPH_SPINE_EXPORT_SELECTS.length);
    for (const q of queries) {
      expect(q.text).toMatch(/WHERE workspace_id = \$1/);
      expect(q.params).toEqual([WS]);
    }
  });

  it("produces a portable archive envelope with GDPR + secret-exclusion notes", async () => {
    const { sql } = fakeSql();
    const archive = await assembleAccountExport(sql, { workspaceId: WS, userId: UID, email: "a@x.test" });
    expect(archive.schemaVersion).toBe(ACCOUNT_EXPORT_SCHEMA_VERSION);
    expect(archive.gdpr.article).toMatch(/Art 20/);
    expect(archive.gdpr.secretExclusionNote).toBe(SECRET_EXCLUSION_NOTE);
    expect(archive.gdpr.externalStoreNote).toBe(EXTERNAL_STORE_EXPORT_NOTE);
    expect(archive.account.workspaceId).toBe(WS);
    expect(archive.account.userId).toBe(UID);
    expect(archive.account.email).toBe("a@x.test");
    // Shape keys present.
    expect(archive.keys).toHaveProperty("gatewayKeys");
    expect(archive.keys).toHaveProperty("managementKeys");
    expect(archive.knowledgeGraph).toHaveProperty("units");
    expect(typeof archive.counts.projects).toBe("number");
  });

  it("never returns a secret-shaped key (assertNoSecretLeakage passes on a real build)", async () => {
    const { sql } = fakeSql();
    const archive = await assembleAccountExport(sql, { workspaceId: WS, userId: UID, email: null });
    // If anything leaked, assembleAccountExport would have thrown; double-check here.
    expect(findForbiddenKey(archive)).toBeNull();
  });

  it("throws if a reader is mutated to leak a secret-shaped key (guard is wired in)", async () => {
    const neon = await import("$lib/server/neon");
    // Force one reader to return a row with a forbidden key.
    (neon.listApiKeysByWorkspace as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "k1", keyPrefix: "rk_x…", keyHash: "LEAKED" },
    ]);
    const { sql } = fakeSql();
    await expect(
      assembleAccountExport(sql, { workspaceId: WS, userId: UID, email: null }),
    ).rejects.toThrow(/forbidden secret-shaped key/);
  });

  it("requires workspaceId and userId", async () => {
    const { sql } = fakeSql();
    await expect(assembleAccountExport(sql, { workspaceId: "", userId: UID, email: null })).rejects.toThrow(
      /workspaceId required/,
    );
    await expect(assembleAccountExport(sql, { workspaceId: WS, userId: "", email: null })).rejects.toThrow(
      /userId required/,
    );
  });
});
