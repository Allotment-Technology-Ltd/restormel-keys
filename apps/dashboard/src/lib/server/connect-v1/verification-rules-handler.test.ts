/**
 * Tests for the verification-rules handlers (Stage 4C): auth, workspace domain-pack override
 * resolution, and the static built-in rule set.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/server/db", () => ({ getProject: vi.fn(), getProjectInWorkspace: vi.fn() }));
vi.mock("$lib/server/connect/domain-pack-service", () => ({
  getSelectedDomainPackId: vi.fn(),
  getDomainPackForUi: vi.fn(),
}));

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const projectId = "660e8400-e29b-41d4-a716-446655440001";
const gatewayLocals = {
  user: { uid: "u1", authType: "gateway_key", projectIdForKey: projectId, keyId: "k1" },
} as unknown as App.Locals;

beforeEach(async () => {
  vi.clearAllMocks();
  const { getProject } = await import("$lib/server/db");
  vi.mocked(getProject).mockResolvedValue({
    id: projectId,
    userId: "u1",
    workspaceId,
  } as Awaited<ReturnType<typeof getProject>>);
});

describe("handleGetActiveVerificationRules", () => {
  it("400s when workspace_id is missing", async () => {
    const { handleGetActiveVerificationRules } = await import("./verification-rules-handler.js");
    const res = await handleGetActiveVerificationRules({ locals: gatewayLocals, workspaceId: null });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });

  it("returns the built-in core rule set when the workspace has no override", async () => {
    const { getSelectedDomainPackId } = await import("$lib/server/connect/domain-pack-service");
    vi.mocked(getSelectedDomainPackId).mockResolvedValue(null);
    const { handleGetActiveVerificationRules } = await import("./verification-rules-handler.js");
    const res = await handleGetActiveVerificationRules({ locals: gatewayLocals, workspaceId });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ruleSet.id).toBe("restormel-core-v1");
  });

  it("applies a domain pack's inline override", async () => {
    const { getSelectedDomainPackId, getDomainPackForUi } = await import("$lib/server/connect/domain-pack-service");
    vi.mocked(getSelectedDomainPackId).mockResolvedValue("pack-1");
    vi.mocked(getDomainPackForUi).mockResolvedValue({
      verification_rules: { type: "inline_overrides", dimension_overrides: { logical_structure: 0.5 } },
    } as unknown as Awaited<ReturnType<typeof getDomainPackForUi>>);
    const { handleGetActiveVerificationRules } = await import("./verification-rules-handler.js");
    const res = await handleGetActiveVerificationRules({ locals: gatewayLocals, workspaceId });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ruleSet.id).toBe("restormel-core-v1+inline");
      expect(res.ruleSet.dimensions.reduce((s, d) => s + d.weight, 0)).toBeCloseTo(1, 6);
    }
  });

  it("falls back to core when the domain-pack lookup throws", async () => {
    const { getSelectedDomainPackId } = await import("$lib/server/connect/domain-pack-service");
    vi.mocked(getSelectedDomainPackId).mockRejectedValue(new Error("db down"));
    const { handleGetActiveVerificationRules } = await import("./verification-rules-handler.js");
    const res = await handleGetActiveVerificationRules({ locals: gatewayLocals, workspaceId });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ruleSet.id).toBe("restormel-core-v1");
  });
});

describe("handleGetBuiltInVerificationRules", () => {
  it("returns the core rule set", async () => {
    const { handleGetBuiltInVerificationRules } = await import("./verification-rules-handler.js");
    const res = handleGetBuiltInVerificationRules();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ruleSet.id).toBe("restormel-core-v1");
      expect(res.ruleSet.dimensions).toHaveLength(6);
    }
  });
});
