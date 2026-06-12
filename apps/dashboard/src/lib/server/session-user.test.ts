import { describe, expect, it } from "vitest";
import { isSignedInSession, requireSessionUser, sessionUser } from "./session-user";

/** Build a minimal App.Locals with the given user. */
function locals(user?: App.Locals["user"]): App.Locals {
  return { user } as App.Locals;
}

describe("session-user helper — the one signed-in convention", () => {
  it("returns the session user for a session auth request", () => {
    const u = { uid: "u-1", email: "a@b.c", authType: "session" as const };
    expect(sessionUser(locals(u))).toEqual(u);
    expect(isSignedInSession(locals(u))).toBe(true);
    expect(requireSessionUser(locals(u))).toEqual(u);
  });

  it("treats a signed-out request (no user) as not a session", () => {
    expect(sessionUser(locals(undefined))).toBeNull();
    expect(isSignedInSession(locals(undefined))).toBe(false);
  });

  it("treats a Gateway key request as NOT a session (matches authType !== 'session')", () => {
    const gateway = {
      uid: "owner-1",
      authType: "gateway_key" as const,
      projectIdForKey: "p1",
      keyId: "k1",
    };
    expect(sessionUser(locals(gateway))).toBeNull();
    expect(isSignedInSession(locals(gateway))).toBe(false);
  });

  it("treats a Management key request as NOT a session", () => {
    const mgmt = {
      uid: "",
      authType: "management_key" as const,
      keyId: "k1",
      workspaceId: "w1",
    };
    expect(sessionUser(locals(mgmt))).toBeNull();
    expect(isSignedInSession(locals(mgmt))).toBe(false);
  });

  it("requireSessionUser throws 401 for a signed-out request", () => {
    expect(() => requireSessionUser(locals(undefined))).toThrowError();
    try {
      requireSessionUser(locals(undefined));
    } catch (e) {
      // @sveltejs/kit error() carries a status on the thrown value.
      expect((e as { status?: number }).status).toBe(401);
    }
  });

  it("requireSessionUser throws 401 for a Bearer-key request", () => {
    const gateway = { uid: "o", authType: "gateway_key" as const, keyId: "k" };
    expect(() => requireSessionUser(locals(gateway))).toThrowError();
  });
});
