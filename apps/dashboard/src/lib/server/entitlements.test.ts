import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/db", () => ({
  getOrCreateDefaultWorkspace: vi.fn(),
  getWorkspace: vi.fn(),
  downgradeWorkspaceIfProExpired: vi.fn(),
  getAuthUserSignupRank: vi.fn(),
  foundingPromoMaxUsers: vi.fn(),
}));

describe("getWorkspaceEntitlements", () => {
  it("grants founder users full pro entitlements regardless of stored plan", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getOrCreateDefaultWorkspace).mockResolvedValue({
      id: "ws_1",
      name: "Default",
      slug: "default",
      ownerUserId: "u_1",
      createdAt: Date.now(),
      plan: "free",
      planExpiresAt: null,
    } as any);
    vi.mocked(db.getWorkspace).mockResolvedValue({
      id: "ws_1",
      name: "Default",
      slug: "default",
      ownerUserId: "u_1",
      createdAt: Date.now(),
      plan: "free",
      planExpiresAt: null,
    } as any);
    vi.mocked(db.downgradeWorkspaceIfProExpired).mockResolvedValue(undefined);
    vi.mocked(db.getAuthUserSignupRank).mockResolvedValue(7);
    vi.mocked(db.foundingPromoMaxUsers).mockReturnValue(50);

    const mod = await import("./entitlements");
    const ent = await mod.getWorkspaceEntitlements({ user: { uid: "u_1" } } as any);

    expect(ent?.plan).toBe("pro");
    expect(ent?.projectLimit).toBe(10);
    expect(ent?.monthlyRequestLimit).toBe(100_000);
    expect(ent?.isFounderUser).toBe(true);
    expect(ent?.foundingProExpiresAt).toBeNull();
    expect(ent?.isServiceAdmin).toBe(false);
  });

  it("keeps non-founder users on free limits when workspace plan is free", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getOrCreateDefaultWorkspace).mockResolvedValue({
      id: "ws_2",
      name: "Default",
      slug: "default",
      ownerUserId: "u_2",
      createdAt: Date.now(),
      plan: "free",
      planExpiresAt: null,
    } as any);
    vi.mocked(db.getWorkspace).mockResolvedValue({
      id: "ws_2",
      name: "Default",
      slug: "default",
      ownerUserId: "u_2",
      createdAt: Date.now(),
      plan: "free",
      planExpiresAt: null,
    } as any);
    vi.mocked(db.downgradeWorkspaceIfProExpired).mockResolvedValue(undefined);
    vi.mocked(db.getAuthUserSignupRank).mockResolvedValue(51);
    vi.mocked(db.foundingPromoMaxUsers).mockReturnValue(50);

    const mod = await import("./entitlements");
    const ent = await mod.getWorkspaceEntitlements({ user: { uid: "u_2" } } as any);

    expect(ent?.plan).toBe("free");
    expect(ent?.projectLimit).toBe(2);
    expect(ent?.monthlyRequestLimit).toBe(1_000);
    expect(ent?.isFounderUser).toBe(false);
    expect(ent?.isServiceAdmin).toBe(false);
  });

  it("grants service admins high limits and pro plan regardless of workspace tier", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getOrCreateDefaultWorkspace).mockResolvedValue({
      id: "ws_op",
      name: "Default",
      slug: "default",
      ownerUserId: "u_op",
      createdAt: Date.now(),
      plan: "free",
      planExpiresAt: null,
    } as any);
    vi.mocked(db.getWorkspace).mockResolvedValue({
      id: "ws_op",
      name: "Default",
      slug: "default",
      ownerUserId: "u_op",
      createdAt: Date.now(),
      plan: "free",
      planExpiresAt: null,
    } as any);
    vi.mocked(db.downgradeWorkspaceIfProExpired).mockResolvedValue(undefined);
    vi.mocked(db.getAuthUserSignupRank).mockResolvedValue(999);
    vi.mocked(db.foundingPromoMaxUsers).mockReturnValue(50);

    const mod = await import("./entitlements");
    const ent = await mod.getWorkspaceEntitlements({
      user: { uid: "u_op", isServiceAdmin: true },
    } as any);

    expect(ent?.plan).toBe("pro");
    expect(ent?.projectLimit).toBe(999);
    expect(ent?.monthlyRequestLimit).toBe(10_000_000);
    expect(ent?.isServiceAdmin).toBe(true);
    expect(ent?.isFounderUser).toBe(false);
  });
});
