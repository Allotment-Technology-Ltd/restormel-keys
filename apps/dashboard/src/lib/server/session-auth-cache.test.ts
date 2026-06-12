import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_AUTH_CACHE_MS,
  invalidateSessionAuthCache,
  resolveSessionAuthContext,
  type SessionAuthDeps,
} from "./session-auth-cache";

function makeDeps(overrides?: Partial<SessionAuthDeps>): SessionAuthDeps & {
  calls: Record<string, number>;
} {
  const calls: Record<string, number> = {
    status: 0,
    founders: 0,
    bootstrap: 0,
    foundersSync: 0,
    upsert: 0,
  };
  return {
    calls,
    resolveServiceAdminStatus: vi.fn(async () => {
      calls.status += 1;
      return true;
    }),
    isFoundersCircleApproved: vi.fn(async () => {
      calls.founders += 1;
      return true;
    }),
    syncServiceOwnerBootstrap: vi.fn(async () => {
      calls.bootstrap += 1;
    }),
    syncFoundersAccessForServiceOwner: vi.fn(async () => {
      calls.foundersSync += 1;
    }),
    upsertUser: vi.fn(async () => {
      calls.upsert += 1;
    }),
    ...overrides,
  };
}

const USER = { uid: "user-1", email: "op@example.com", role: null };

describe("resolveSessionAuthContext", () => {
  beforeEach(() => {
    invalidateSessionAuthCache();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("memoizes status lookups within the TTL", async () => {
    const deps = makeDeps();
    const first = await resolveSessionAuthContext(USER, deps);
    const second = await resolveSessionAuthContext(USER, deps);
    expect(first).toEqual({ isServiceAdmin: true, foundersCircleApproved: true });
    expect(second).toEqual(first);
    expect(deps.calls.status).toBe(1);
    expect(deps.calls.founders).toBe(1);
  });

  it("re-resolves after the TTL expires but still runs bootstrap syncs only once", async () => {
    const deps = makeDeps();
    await resolveSessionAuthContext(USER, deps);
    vi.advanceTimersByTime(SESSION_AUTH_CACHE_MS + 1);
    await resolveSessionAuthContext(USER, deps);
    expect(deps.calls.status).toBe(2);
    expect(deps.calls.bootstrap).toBe(1);
    expect(deps.calls.foundersSync).toBe(1);
    expect(deps.calls.upsert).toBe(1);
  });

  it("treats a changed email as a separate cache entry", async () => {
    const deps = makeDeps();
    await resolveSessionAuthContext(USER, deps);
    await resolveSessionAuthContext({ ...USER, email: "new@example.com" }, deps);
    expect(deps.calls.status).toBe(2);
    expect(deps.calls.bootstrap).toBe(2);
  });

  it("does not cache failed founders lookups (null)", async () => {
    const deps = makeDeps({
      resolveServiceAdminStatus: vi.fn(async () => false),
      isFoundersCircleApproved: vi.fn(async () => null),
    });
    const first = await resolveSessionAuthContext(USER, deps);
    expect(first.foundersCircleApproved).toBeNull();
    await resolveSessionAuthContext(USER, deps);
    // Second call re-ran the lookup instead of serving the failed result.
    expect(deps.isFoundersCircleApproved).toHaveBeenCalledTimes(2);
  });

  it("retries bootstrap syncs on the next resolve when they fail", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let failures = 0;
    const deps = makeDeps({
      upsertUser: vi.fn(async () => {
        failures += 1;
        if (failures === 1) throw new Error("transient");
      }),
    });
    await resolveSessionAuthContext(USER, deps);
    vi.advanceTimersByTime(SESSION_AUTH_CACHE_MS + 1);
    await resolveSessionAuthContext(USER, deps);
    expect(deps.upsertUser).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it("invalidateSessionAuthCache drops cached statuses", async () => {
    const deps = makeDeps();
    await resolveSessionAuthContext(USER, deps);
    invalidateSessionAuthCache();
    await resolveSessionAuthContext(USER, deps);
    expect(deps.calls.status).toBe(2);
  });

  it("invalidateSessionAuthCache(uid) only drops that user", async () => {
    const deps = makeDeps();
    await resolveSessionAuthContext(USER, deps);
    await resolveSessionAuthContext({ uid: "user-2", email: "b@example.com", role: null }, deps);
    invalidateSessionAuthCache("user-1");
    await resolveSessionAuthContext(USER, deps); // re-resolves
    await resolveSessionAuthContext(
      { uid: "user-2", email: "b@example.com", role: null },
      deps
    ); // cached
    expect(deps.calls.status).toBe(3);
  });
});
