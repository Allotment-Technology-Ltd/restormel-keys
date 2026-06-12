import { describe, expect, it } from "vitest";

// W4.6a SECURITY (S1) — the ADMIN tree is fail-CLOSED under degraded auth.
//
// A security review found the original W4.6a degraded-auth handling converted the admin
// tree from fail-closed to fail-open: the admin layout returned `{ authDegraded: true }`
// instead of throwing, the admin `+layout.svelte` rendered `<slot/>` unconditionally, and
// the admin child page loads had NO auth checks of their own. Under a Neon Auth 5xx/429
// window, a forged `__Secure-x=1` cookie would therefore serve the full admin pages with
// sensitive data serialized (user emails, founders requests, operator emails).
//
// These tests pin BOTH layers fail-closed:
//   (a) the admin layout THROWS 503 under degraded (a throw — not a `{ authDegraded }`
//       return — prevents SvelteKit from serializing child-page data), and
//   (b) `requireServiceAdminSession` (the defense-in-depth gate on each admin child load)
//       throws 503 under degraded / 403 for signed-out or non-admin, and never returns a
//       user — so no future layout change can fail the child pages open.

import { load as adminLayoutLoad } from "../../routes/keys/admin/+layout.server";
import { requireServiceAdminSession } from "./session-user";

type Thrown = { status?: number; location?: string };

function locals(over: Partial<App.Locals>): App.Locals {
  return over as App.Locals;
}

const adminUser = { uid: "u-admin", email: "ops@restormel.dev", authType: "session" as const, isServiceAdmin: true };
const plainUser = { uid: "u-1", email: "a@b.c", authType: "session" as const, isServiceAdmin: false };

// Minimal LayoutServerLoadEvent stand-in: the load only touches `locals` and `url`.
function layoutEvent(over: Partial<App.Locals>, pathname = "/keys/admin/users") {
  return {
    locals: locals(over),
    url: new URL(`https://restormel.dev${pathname}`),
  } as Parameters<typeof adminLayoutLoad>[0];
}

describe("admin +layout.server fail-closed (W4.6a S1)", () => {
  it("THROWS 503 under degraded auth — no `{ authDegraded }` return, so child data is never serialized", async () => {
    // Forged-cookie scenario: no resolved user, but verification couldn't complete.
    let caught: Thrown | null = null;
    let returned: unknown = "DID_NOT_THROW";
    try {
      returned = await adminLayoutLoad(layoutEvent({ user: undefined, authDegraded: true }));
    } catch (e) {
      caught = e as Thrown;
    }
    expect(returned).toBe("DID_NOT_THROW"); // it must throw, never return
    expect(caught?.status).toBe(503); // honest "couldn't verify" — NOT a silent login redirect
    // A 503 is an error throw, not a redirect: it carries no Location.
    expect(caught?.location).toBeUndefined();
  });

  it("redirects a genuinely signed-out request to login (not 503)", async () => {
    let caught: Thrown | null = null;
    try {
      await adminLayoutLoad(layoutEvent({ user: undefined, authDegraded: false }));
    } catch (e) {
      caught = e as Thrown;
    }
    expect(caught?.status).toBe(302);
    expect(caught?.location).toContain("/login");
  });

  it("redirects a signed-in NON-admin away from the admin tree", async () => {
    let caught: Thrown | null = null;
    try {
      await adminLayoutLoad(layoutEvent({ user: plainUser }));
    } catch (e) {
      caught = e as Thrown;
    }
    expect(caught?.status).toBe(302);
  });

  it("allows a verified service admin through", async () => {
    const data = await adminLayoutLoad(layoutEvent({ user: adminUser }));
    expect(data).toEqual({});
  });
});

describe("requireServiceAdminSession defense-in-depth gate (W4.6a S1b)", () => {
  it("throws 503 under degraded auth — admin child loads never serialize data on an infra blip", () => {
    let caught: Thrown | null = null;
    try {
      requireServiceAdminSession(locals({ user: undefined, authDegraded: true }));
    } catch (e) {
      caught = e as Thrown;
    }
    expect(caught?.status).toBe(503);
  });

  it("throws 403 for a genuinely signed-out request", () => {
    let caught: Thrown | null = null;
    try {
      requireServiceAdminSession(locals({ user: undefined, authDegraded: false }));
    } catch (e) {
      caught = e as Thrown;
    }
    expect(caught?.status).toBe(403);
  });

  it("throws 403 for a signed-in NON-admin session", () => {
    let caught: Thrown | null = null;
    try {
      requireServiceAdminSession(locals({ user: plainUser }));
    } catch (e) {
      caught = e as Thrown;
    }
    expect(caught?.status).toBe(403);
  });

  it("returns the user only for a verified service admin", () => {
    expect(requireServiceAdminSession(locals({ user: adminUser }))).toEqual(adminUser);
  });
});
