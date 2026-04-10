import { afterEach, describe, expect, it, vi } from "vitest";

describe("resolveServiceAdminStatus", () => {
  const origAdminIds = process.env.RESTORMEL_SERVICE_ADMIN_USER_IDS;
  const origOwnerEmails = process.env.RESTORMEL_SERVICE_OWNER_EMAILS;

  afterEach(() => {
    process.env.RESTORMEL_SERVICE_ADMIN_USER_IDS = origAdminIds;
    process.env.RESTORMEL_SERVICE_OWNER_EMAILS = origOwnerEmails;
    vi.resetModules();
  });

  it("returns true when session role is admin", async () => {
    const mod = await import("./service-admin");
    expect(await mod.resolveServiceAdminStatus("any-id", "Admin")).toBe(true);
    expect(await mod.resolveServiceAdminStatus("any-id", "service_admin")).toBe(true);
  });

  it("returns true when user id is listed in RESTORMEL_SERVICE_ADMIN_USER_IDS", async () => {
    process.env.RESTORMEL_SERVICE_ADMIN_USER_IDS = "user-a, user-b";
    process.env.RESTORMEL_SERVICE_OWNER_EMAILS = "";
    const mod = await import("./service-admin");
    expect(await mod.resolveServiceAdminStatus("user-a", null, null)).toBe(true);
    expect(await mod.resolveServiceAdminStatus("user-b", null, null)).toBe(true);
    expect(await mod.resolveServiceAdminStatus("user-c", null, null)).toBe(false);
  });

  it("returns true for default primary owner emails when RESTORMEL_SERVICE_OWNER_EMAILS is unset", async () => {
    delete process.env.RESTORMEL_SERVICE_OWNER_EMAILS;
    const mod = await import("./service-admin");
    expect(await mod.resolveServiceAdminStatus("any", null, "Adam.Boon1984@gmail.com")).toBe(true);
    expect(await mod.resolveServiceAdminStatus("any", null, "adam.boon1984@googlemail.com")).toBe(true);
  });

  it("returns false for default emails when RESTORMEL_SERVICE_OWNER_EMAILS is empty", async () => {
    process.env.RESTORMEL_SERVICE_OWNER_EMAILS = "";
    const mod = await import("./service-admin");
    expect(await mod.resolveServiceAdminStatus("any", null, "adam.boon1984@gmail.com")).toBe(false);
  });

  it("returns true for custom RESTORMEL_SERVICE_OWNER_EMAILS", async () => {
    process.env.RESTORMEL_SERVICE_OWNER_EMAILS = "ops@example.com";
    const mod = await import("./service-admin");
    expect(await mod.resolveServiceAdminStatus("u1", null, "OPS@example.com")).toBe(true);
    expect(await mod.resolveServiceAdminStatus("u1", null, "other@example.com")).toBe(false);
  });
});
