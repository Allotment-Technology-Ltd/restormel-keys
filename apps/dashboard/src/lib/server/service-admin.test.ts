import { afterEach, describe, expect, it, vi } from "vitest";

describe("resolveServiceAdminStatus", () => {
  const origEnv = process.env.RESTORMEL_SERVICE_ADMIN_USER_IDS;

  afterEach(() => {
    process.env.RESTORMEL_SERVICE_ADMIN_USER_IDS = origEnv;
    vi.resetModules();
  });

  it("returns true when session role is admin", async () => {
    const mod = await import("./service-admin");
    expect(await mod.resolveServiceAdminStatus("any-id", "Admin")).toBe(true);
    expect(await mod.resolveServiceAdminStatus("any-id", "service_admin")).toBe(true);
  });

  it("returns true when user id is listed in RESTORMEL_SERVICE_ADMIN_USER_IDS", async () => {
    process.env.RESTORMEL_SERVICE_ADMIN_USER_IDS = "user-a, user-b";
    const mod = await import("./service-admin");
    expect(await mod.resolveServiceAdminStatus("user-a", null)).toBe(true);
    expect(await mod.resolveServiceAdminStatus("user-b", null)).toBe(true);
    expect(await mod.resolveServiceAdminStatus("user-c", null)).toBe(false);
  });

});
