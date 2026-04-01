import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/db", () => ({
  getAuthUserSignupRank: vi.fn(),
  foundingPromoMaxUsers: vi.fn(),
  getWorkspace: vi.fn(),
}));

describe("hasProAccess", () => {
  const originalFeatures = process.env.RESTORMEL_PRO_FEATURES;
  const originalDevDefault = process.env.RESTORMEL_PRO_DEV_DEFAULT;

  afterAll(() => {
    process.env.RESTORMEL_PRO_FEATURES = originalFeatures;
    process.env.RESTORMEL_PRO_DEV_DEFAULT = originalDevDefault;
  });

  it("returns true for founder users even when env-gated pro features are disabled", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getAuthUserSignupRank).mockResolvedValue(12);
    vi.mocked(db.foundingPromoMaxUsers).mockReturnValue(50);
    process.env.RESTORMEL_PRO_FEATURES = "";
    process.env.RESTORMEL_PRO_DEV_DEFAULT = "false";

    const mod = await import("./feature-gates");
    const ok = await mod.hasProAccess({ user: { uid: "u_founder" } }, "healthcheck");
    expect(ok).toBe(true);
  });

  it("returns true for service admins when env-gated pro features are disabled", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getAuthUserSignupRank).mockResolvedValue(88);
    vi.mocked(db.foundingPromoMaxUsers).mockReturnValue(50);
    process.env.RESTORMEL_PRO_FEATURES = "";
    process.env.RESTORMEL_PRO_DEV_DEFAULT = "false";

    const mod = await import("./feature-gates");
    const ok = await mod.hasProAccess({ user: { uid: "u_op", isServiceAdmin: true } }, "embedding");
    expect(ok).toBe(true);
  });

  it("falls back to env gate for non-founder users", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getAuthUserSignupRank).mockResolvedValue(88);
    vi.mocked(db.foundingPromoMaxUsers).mockReturnValue(50);
    process.env.RESTORMEL_PRO_FEATURES = "";
    process.env.RESTORMEL_PRO_DEV_DEFAULT = "false";

    const mod = await import("./feature-gates");
    const ok = await mod.hasProAccess({ user: { uid: "u_non_founder" } }, "embedding");
    expect(ok).toBe(false);
  });
});
