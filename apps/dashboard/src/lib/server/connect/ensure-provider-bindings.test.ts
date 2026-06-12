/**
 * Stage K3: idempotent provider→project binding creation (the K-P0-2 repair used by
 * applyRecommendedIngestionRoutes). Deps are injected — no module mocking needed.
 */
import { describe, it, expect, vi } from "vitest";

// The module's default deps import the real data layer — mock it so this unit test
// stays hermetic (every call site under test passes injected deps).
vi.mock("$lib/server/db", () => ({
  listProviderIntegrations: vi.fn(),
  listProviderBindingsByProject: vi.fn(),
  createProviderBinding: vi.fn(),
}));

import {
  ensureProviderBindingsForProviders,
  type EnsureProviderBindingsDeps,
} from "./ensure-provider-bindings";

function integration(over: Record<string, unknown> = {}) {
  return {
    id: "int-openai",
    workspaceId: "ws-1",
    providerType: "openai",
    displayName: "OpenAI prod",
    status: "active",
    verificationStatus: "verified",
    credentialRef: null,
    createdBy: null,
    createdAt: 0,
    lastVerifiedAt: null,
    metadata: null,
    region: null,
    hasEncryptedCredential: true,
    credentialMasked: null,
    ...over,
  };
}

function makeDeps(args: {
  integrations?: ReturnType<typeof integration>[];
  bindings?: { integration: { id: string; providerType: string } }[];
}): { deps: EnsureProviderBindingsDeps; created: unknown[] } {
  const created: unknown[] = [];
  const deps = {
    listProviderIntegrations: vi.fn(async () => args.integrations ?? []),
    listProviderBindingsByProject: vi.fn(async () => args.bindings ?? []),
    createProviderBinding: vi.fn(async (params: unknown) => {
      created.push(params);
      return { id: `bind-${created.length}` };
    }),
  } as unknown as EnsureProviderBindingsDeps;
  return { deps, created };
}

const ARGS = {
  workspaceId: "ws-1",
  projectId: "proj-1",
  environmentId: "env-1",
  actorId: "user-1",
  actorType: "session",
};

describe("ensureProviderBindingsForProviders", () => {
  it("creates a binding for an unbound provider with an eligible integration", async () => {
    const { deps, created } = makeDeps({ integrations: [integration()] });
    const out = await ensureProviderBindingsForProviders(
      { ...ARGS, providers: ["openai"] },
      deps,
    );
    expect(out).toEqual([{ provider: "openai", integrationId: "int-openai", created: true }]);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      providerIntegrationId: "int-openai",
      projectId: "proj-1",
      environmentId: "env-1",
      workspaceId: "ws-1",
    });
  });

  it("is idempotent: an existing binding short-circuits without creating", async () => {
    const { deps, created } = makeDeps({
      integrations: [integration()],
      bindings: [{ integration: { id: "int-openai", providerType: "openai" } }],
    });
    const out = await ensureProviderBindingsForProviders(
      { ...ARGS, providers: ["openai"] },
      deps,
    );
    expect(out).toEqual([{ provider: "openai", integrationId: "int-openai", created: false }]);
    expect(created).toHaveLength(0);
  });

  it("dedupes providers and normalizes aliases (google → vertex)", async () => {
    const { deps, created } = makeDeps({
      integrations: [integration({ id: "int-vertex", providerType: "google" })],
    });
    const out = await ensureProviderBindingsForProviders(
      { ...ARGS, providers: ["google", "vertex", "Google"] },
      deps,
    );
    expect(out).toEqual([{ provider: "vertex", integrationId: "int-vertex", created: true }]);
    expect(created).toHaveLength(1); // one binding for the deduped canonical provider
  });

  it("skips providers with no eligible integration (inactive / no stored credential / unknown)", async () => {
    const { deps, created } = makeDeps({
      integrations: [
        integration({ id: "int-a", providerType: "openai", status: "disabled" }),
        integration({ id: "int-b", providerType: "anthropic", hasEncryptedCredential: false }),
      ],
    });
    const out = await ensureProviderBindingsForProviders(
      { ...ARGS, providers: ["openai", "anthropic", "not-a-provider", ""] },
      deps,
    );
    expect(out).toEqual([]);
    expect(created).toHaveLength(0);
  });

  it("create failures are swallowed per-provider, not fatal for the batch", async () => {
    const { deps } = makeDeps({
      integrations: [
        integration(),
        integration({ id: "int-anthropic", providerType: "anthropic" }),
      ],
    });
    (deps.createProviderBinding as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("insert failed"))
      .mockResolvedValueOnce({ id: "bind-ok" });
    const out = await ensureProviderBindingsForProviders(
      { ...ARGS, providers: ["openai", "anthropic"] },
      deps,
    );
    expect(out).toHaveLength(1);
    expect(out[0].created).toBe(true);
  });

  it("returns [] for an empty provider list without touching the db", async () => {
    const { deps } = makeDeps({});
    const out = await ensureProviderBindingsForProviders({ ...ARGS, providers: [] }, deps);
    expect(out).toEqual([]);
    expect(deps.listProviderIntegrations).not.toHaveBeenCalled();
  });
});
