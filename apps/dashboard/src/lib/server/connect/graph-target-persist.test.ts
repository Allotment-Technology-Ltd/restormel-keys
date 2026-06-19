/**
 * Regression test for incident 2026-06-18-prod-add-graph-500.
 *
 * Root cause: the Graph Library columns (label / default_domain_pack_id / settings)
 * and the dropped one-graph-per-workspace UNIQUE constraint existed only in runtime
 * DDL (ensureIngestionRoutingSchema), which is DISABLED in production. So in prod the
 * INSERT into knowledge_graph_targets referenced columns that did not exist; Postgres
 * threw `column "settings" does not exist` and the route returned a BARE HTTP 500.
 *
 * Defence-in-depth (this test): persistGraphTarget must CATCH a DB throw and return a
 * typed result (never let it become a 500), with an actionable message — and must NOT
 * leak the secret in the result or the logs. The migration (070) + REQUIRED_MIGRATION
 * bump are the primary fix; this guards the failure path itself.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ConnectGraphTargetRecord } from "$lib/server/neon";

vi.mock("$lib/server/neon", () => ({
  getConnectGraphTargetById: vi.fn(),
  getConnectStageRoutingConfig: vi.fn(),
  upsertConnectStageRoutingConfig: vi.fn(),
  deleteConnectGraphTarget: vi.fn(),
  getConnectGraphTargetForWorkspace: vi.fn(),
  getConnectStageRoutingConfig2: vi.fn(),
  listConnectGraphTargetsForWorkspace: vi.fn().mockResolvedValue([]),
  pingDashboardDatabase: vi.fn(),
  updateConnectGraphTargetStatus: vi.fn(),
  upsertConnectGraphTarget: vi.fn(),
  invalidateConnectGraphStatsCache: vi.fn(),
}));

// Encryption is CONFIGURED in this test so we get past the crypto guard and reach
// the DB write (the actual failure point in prod). The secret stays ciphertext.
vi.mock("$lib/server/credential-crypto", () => ({
  isCredentialEncryptionConfigured: () => true,
  credentialEncryptionMisconfigReason: () => null,
  encryptProviderSecret: (plaintext: string) => ({
    ok: true,
    payload: { ciphertextB64: "ct", ivB64: "iv", authTagB64: "tag", encryptionVersion: 1 },
  }),
  decryptProviderSecret: () => ({ ok: false, error: "no ciphertext" }),
}));

const upsertInput = {
  provider: "surreal" as const,
  endpoint: "wss://surreal.restormel.dev",
  namespace: "main",
  database: "sophia",
  username: "root",
  secret: "super-secret-password-value",
  default_domain_pack_id: "pack-claim-argument",
};

describe("persistGraphTarget — DB throw is mapped to a typed result, not a 500", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps a schema-drift INSERT error (undefined column) to 503 server_misconfigured", async () => {
    const neon = await import("$lib/server/neon");
    vi.mocked(neon.upsertConnectGraphTarget).mockRejectedValue(
      new Error('error: column "settings" of relation "knowledge_graph_targets" does not exist'),
    );

    const { createGraphTarget } = await import("./graph-target-service");
    const result = await createGraphTarget("ws-1", upsertInput, { activate: true });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.status).toBe(503);
    expect(result.error).toBe("server_misconfigured");
    expect(result.message).toMatch(/migration|configuration/i);
    // Never leak the plaintext secret in the user-facing message.
    expect(JSON.stringify(result)).not.toContain(upsertInput.secret);
  });

  it("never logs the plaintext secret when persistence throws", async () => {
    const neon = await import("$lib/server/neon");
    vi.mocked(neon.upsertConnectGraphTarget).mockRejectedValue(
      new Error("connection terminated unexpectedly"),
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { saveGraphTarget } = await import("./graph-target-service");
    const result = await saveGraphTarget("ws-1", upsertInput);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    // A generic (non-drift) DB error maps to storage_unavailable, still 503, no 500.
    expect(result.status).toBe(503);
    expect(result.error).toBe("storage_unavailable");

    const logged = errSpy.mock.calls.map((c) => JSON.stringify(c)).join("\n");
    expect(logged).not.toContain(upsertInput.secret);
    errSpy.mockRestore();
  });

  it("succeeds (no throw) on a healthy schema, returning the target", async () => {
    const neon = await import("$lib/server/neon");
    const row: ConnectGraphTargetRecord = {
      id: "g-new",
      workspaceId: "ws-1",
      label: "main/sophia",
      provider: "surreal",
      endpoint: upsertInput.endpoint,
      namespace: "main",
      database: "sophia",
      username: "root",
      useDashboardDatabase: false,
      defaultDomainPackId: "pack-claim-argument",
      settings: {},
      secretCiphertext: "ct",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretEncryptionVersion: 1,
      status: "untested",
      lastTestedAt: null,
      lastError: null,
      createdAt: 0,
      updatedAt: 0,
    };
    vi.mocked(neon.upsertConnectGraphTarget).mockResolvedValue(row);
    vi.mocked(neon.getConnectStageRoutingConfig).mockResolvedValue({});
    vi.mocked(neon.getConnectGraphTargetById).mockResolvedValue(row);

    const { createGraphTarget } = await import("./graph-target-service");
    const result = await createGraphTarget("ws-1", upsertInput, { activate: true });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.target.id).toBe("g-new");
    // secret_set is true (ciphertext present) but the plaintext is NEVER echoed.
    expect(result.target.secret_set).toBe(true);
    expect(JSON.stringify(result.target)).not.toContain(upsertInput.secret);
  });
});
