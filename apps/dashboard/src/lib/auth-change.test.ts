import { describe, expect, it } from "vitest";
import { shouldInvalidateOnSessionPoll } from "./auth-change";

// W4.6a — the client session-refresh loop invalidates (re-runs shell + page loads) only
// on a DEFINITE auth-state change, so the shell and pages stop disagreeing — and never on
// a degraded poll (which would flap the shell on every infra blip).

describe("shouldInvalidateOnSessionPoll", () => {
  it("invalidates when the poll reports signed-out but the client shows signed-in", () => {
    expect(shouldInvalidateOnSessionPoll(true, { signedIn: false })).toBe(true);
  });

  it("invalidates when the poll reports signed-in but the client shows signed-out", () => {
    expect(shouldInvalidateOnSessionPoll(false, { signedIn: true })).toBe(true);
  });

  it("does NOT invalidate when the poll agrees with the client (signed-in)", () => {
    expect(shouldInvalidateOnSessionPoll(true, { signedIn: true })).toBe(false);
  });

  it("does NOT invalidate when the poll agrees with the client (signed-out)", () => {
    expect(shouldInvalidateOnSessionPoll(false, { signedIn: false })).toBe(false);
  });

  it("does NOT invalidate on a degraded poll, even if signedIn disagrees", () => {
    // Verification couldn't complete — treating it as a sign-out would flap the shell.
    expect(shouldInvalidateOnSessionPoll(true, { signedIn: false, degraded: true })).toBe(false);
    expect(shouldInvalidateOnSessionPoll(false, { signedIn: true, degraded: true })).toBe(false);
  });
});
