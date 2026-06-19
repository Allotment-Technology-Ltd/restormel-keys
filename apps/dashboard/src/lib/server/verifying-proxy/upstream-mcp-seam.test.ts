/**
 * Tests for `buildWorkspaceUpstreamMcpSeam` — the Phase B → Phase C adapter
 * (REC-PLAN-010 / REC-PLAN-011 wiring).
 *
 * Verifies that:
 *   - ok: true  → WorkspaceUpstreamMcp with `url` mapped from `descriptor.endpoint`
 *   - ok: false (any reason) → null (fail closed; Phase C turns this into 403)
 *   - `secret` is never exposed on the returned WorkspaceUpstreamMcp
 *   - `workspaceId` is preserved exactly (no cross-workspace drift)
 *   - flag OFF (RESTORMEL_VERIFYING_PROXY unset) → null (service returns ok:false)
 *
 * The adapter is pure: it wraps Phase B's `buildWorkspaceUpstreamMcp`. We mock that
 * function's DB layer hermetically (no network, no Postgres) matching the pattern in
 * upstream-mcp-service.test.ts. Tests do NOT exercise Svelte render — pure logic only
 * (see CLAUDE.md / vitest browser-condition gotcha).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpstreamMcpTargetRecord } from "$lib/server/neon";

// ── Hermetic env ──────────────────────────────────────────────────────────────
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {} as Record<string, string | undefined>,
}));
vi.mock("$env/dynamic/private", () => ({ env: mockEnv }));

// In-memory store mirroring upstream-mcp-service.test.ts pattern.
const { store } = vi.hoisted(() => ({ store: new Map<string, UpstreamMcpTargetRecord>() }));

vi.mock("$lib/server/neon", () => ({
  listUpstreamMcpTargetsForWorkspace: vi.fn(async (workspaceId: string) =>
    [...store.values()]
      .filter((r) => r.workspaceId === workspaceId)
      .sort((a, b) => b.updatedAt - a.updatedAt),
  ),
  getUpstreamMcpTargetById: vi.fn(
    async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      const row = store.get(id);
      return row && row.workspaceId === workspaceId ? row : null;
    },
  ),
  findUpstreamMcpTargetByPhysical: vi.fn(async () => null),
  upsertUpstreamMcpTarget: vi.fn(async (params: Record<string, unknown>) => {
    const now = Date.now();
    const id = (params.id as string) ?? `up-seam-${store.size + 1}`;
    const row: UpstreamMcpTargetRecord = {
      id,
      workspaceId: params.workspaceId as string,
      label: (params.label as string | null) ?? null,
      transport: (params.transport as string) ?? "streamable-http",
      endpoint: (params.endpoint as string) ?? "",
      namespace: null,
      database: null,
      allowedTools: null,
      secretCiphertext: null,
      secretIv: null,
      secretAuthTag: null,
      secretEncryptionVersion: 0,
      status: "untested",
      lastTestedAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
    store.set(id, row);
    return row;
  }),
  deleteUpstreamMcpTarget: vi.fn(async () => false),
  updateUpstreamMcpTargetStatus: vi.fn(async () => {}),
}));

import { buildWorkspaceUpstreamMcpSeam } from "./upstream-mcp-seam.js";

const TEST_KEY_B64 = Buffer.alloc(32, 9).toString("base64");
const origFlag = process.env.RESTORMEL_VERIFYING_PROXY;
const origNodeEnv = process.env.NODE_ENV;

function seedRow(id: string, workspaceId: string, endpoint: string): UpstreamMcpTargetRecord {
  const row: UpstreamMcpTargetRecord = {
    id,
    workspaceId,
    label: `label-${id}`,
    transport: "streamable-http",
    endpoint,
    namespace: null,
    database: null,
    allowedTools: null,
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
  store.set(id, row);
  return row;
}

describe("buildWorkspaceUpstreamMcpSeam (Phase B → Phase C adapter)", () => {
  beforeEach(() => {
    store.clear();
    mockEnv.RESTORMEL_CREDENTIALS_ENCRYPTION_KEY = TEST_KEY_B64;
    process.env.RESTORMEL_VERIFYING_PROXY = "1";
    process.env.NODE_ENV = "production"; // strict SSRF
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.NODE_ENV = origNodeEnv;
    if (origFlag === undefined) delete process.env.RESTORMEL_VERIFYING_PROXY;
    else process.env.RESTORMEL_VERIFYING_PROXY = origFlag;
    for (const k of Object.keys(mockEnv)) delete mockEnv[k];
  });

  it("maps descriptor.endpoint → WorkspaceUpstreamMcp.url correctly", async () => {
    seedRow("r-1", "ws-a", "https://mcp.tenant-a.example/sse");
    const result = await buildWorkspaceUpstreamMcpSeam("ws-a");
    expect(result).not.toBeNull();
    expect(result?.url).toBe("https://mcp.tenant-a.example/sse");
  });

  it("preserves workspaceId on the returned target (no cross-workspace drift)", async () => {
    seedRow("r-2", "ws-b", "https://mcp.tenant-b.example/sse");
    const result = await buildWorkspaceUpstreamMcpSeam("ws-b");
    expect(result?.workspaceId).toBe("ws-b");
  });

  it("returns null when no upstream is bound to the workspace (fail closed)", async () => {
    // Store is empty — no target for ws-unknown.
    const result = await buildWorkspaceUpstreamMcpSeam("ws-unknown");
    expect(result).toBeNull();
  });

  it("returns null when the flag is OFF (feature not active) → fail closed", async () => {
    seedRow("r-3", "ws-a", "https://mcp.tenant-a.example/sse");
    delete process.env.RESTORMEL_VERIFYING_PROXY;
    const result = await buildWorkspaceUpstreamMcpSeam("ws-a");
    expect(result).toBeNull();
  });

  it("returns null when the endpoint fails the SSRF guard at dial-time → fail closed", async () => {
    // Seed a row with a private-range endpoint (simulates a pre-SSRF-policy row).
    seedRow("r-4", "ws-c", "https://169.254.169.254/latest/meta-data/");
    const result = await buildWorkspaceUpstreamMcpSeam("ws-c");
    expect(result).toBeNull();
  });

  it("does NOT expose the secret on the returned WorkspaceUpstreamMcp", async () => {
    // Seed with a row that has a ciphertext stored (secret is not decrypted for the seam).
    const row = seedRow("r-5", "ws-d", "https://mcp.tenant-d.example/sse");
    row.secretCiphertext = "some-ciphertext-that-must-not-leak";
    const result = await buildWorkspaceUpstreamMcpSeam("ws-d");
    expect(result).not.toBeNull();
    // The WorkspaceUpstreamMcp type has no `secret` field — assert the returned object
    // does not carry one either.
    expect(result).not.toHaveProperty("secret");
    expect(JSON.stringify(result)).not.toContain("some-ciphertext-that-must-not-leak");
  });

  it("workspace A's id cannot resolve workspace B's target (isolation)", async () => {
    seedRow("r-6", "ws-b", "https://mcp.tenant-b.example/sse");
    // Ask for ws-a, which has no registered target.
    const result = await buildWorkspaceUpstreamMcpSeam("ws-a");
    expect(result).toBeNull();
  });

  it("satisfies BuildWorkspaceUpstreamMcp type (structural) — returns null | WorkspaceUpstreamMcp", async () => {
    // Demonstrates the adapter result is directly injectable as BuildWorkspaceUpstreamMcp.
    seedRow("r-7", "ws-e", "https://mcp.tenant-e.example/sse");
    const result = await buildWorkspaceUpstreamMcpSeam("ws-e");
    expect(result).toMatchObject({
      workspaceId: "ws-e",
      url: "https://mcp.tenant-e.example/sse",
    });
    // projectId is absent when no project binding exists (workspace-granularity auth).
    expect(result).not.toHaveProperty("projectId");
  });
});
