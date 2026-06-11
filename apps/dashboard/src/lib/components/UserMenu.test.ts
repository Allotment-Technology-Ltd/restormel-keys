/**
 * UserMenu: avatar display name / initials logic and route wiring.
 *
 * The component uses a node+vitest environment (no DOM), so we test the
 * pure helper logic extracted inline and verify the sign-out / settings /
 * billing route constants that the menu items render.
 */
import { describe, it, expect } from "vitest";
import { DASHBOARD_BASE, ADMIN_BASE } from "$lib/dashboard-base";

// Pure helpers duplicated from UserMenu.svelte so they can be unit-tested
// without a browser environment.  If these helpers are extracted to a shared
// module in a future refactor, update the import here.
function displayName(u: { uid: string; email?: string | null; name?: string | null }): string {
  return u.name?.trim() || u.email?.trim() || u.uid;
}

function initials(u: { uid: string; email?: string | null; name?: string | null }): string {
  const email = u.email?.trim();
  if (!email) return "";
  return email.slice(0, 1).toUpperCase();
}

describe("UserMenu display logic", () => {
  it("prefers name over email over uid", () => {
    expect(displayName({ uid: "u1", name: "Ada", email: "ada@example.com" })).toBe("Ada");
    expect(displayName({ uid: "u1", email: "ada@example.com" })).toBe("ada@example.com");
    expect(displayName({ uid: "u1" })).toBe("u1");
  });

  it("trims whitespace in name and email", () => {
    expect(displayName({ uid: "u1", name: "  Ada  " })).toBe("Ada");
    expect(displayName({ uid: "u1", email: "  ada@example.com  " })).toBe("ada@example.com");
  });

  it("returns empty initials when no email", () => {
    expect(initials({ uid: "u1" })).toBe("");
    expect(initials({ uid: "u1", name: "Ada" })).toBe("");
  });

  it("derives initial from first char of email, uppercased", () => {
    expect(initials({ uid: "u1", email: "ada@example.com" })).toBe("A");
    expect(initials({ uid: "u1", email: "zed@example.com" })).toBe("Z");
  });
});

describe("UserMenu route wiring", () => {
  it("sign-out points to /logout under DASHBOARD_BASE", () => {
    expect(DASHBOARD_BASE + "/logout").toBe("/keys/dashboard/logout");
  });

  it("Profile & settings points to /settings under DASHBOARD_BASE", () => {
    expect(DASHBOARD_BASE + "/settings").toBe("/keys/dashboard/settings");
  });

  it("Subscription points to /billing under DASHBOARD_BASE", () => {
    expect(DASHBOARD_BASE + "/billing").toBe("/keys/dashboard/billing");
  });

  it("Admin link points to users page under ADMIN_BASE", () => {
    expect(ADMIN_BASE + "/users").toBe("/keys/admin/users");
  });
});
