// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resolveMailIdentity } from "./send-mail";
import { FOUNDERS_REJECTED_SUBJECT, foundersRejectedText } from "./founders-rejected-email";

// Pure-contract assertions only. The Svelte→HTML render (buildFoundersRejectedEmail) is NOT
// exercised here: this vitest project sets `resolve.conditions: ["browser"]`, which is
// incompatible with `svelte/server` render. The server render is verified separately and runs
// correctly under SvelteKit's server conditions at runtime.

describe("founders-rejected-email", () => {
  it("is sent on the transactional identity (notify@ From, contact@ Reply-To)", () => {
    const id = resolveMailIdentity("transactional");
    expect(id.from).toContain("notify@");
    expect(id.replyTo).toBe("contact@restormel.dev");
  });

  it("has a clear, on-brand subject about the application", () => {
    expect(FOUNDERS_REJECTED_SUBJECT.toLowerCase()).toContain("founders circle");
    expect(FOUNDERS_REJECTED_SUBJECT.toLowerCase()).toContain("application");
  });

  it("plain text includes the personalised greeting", () => {
    const text = foundersRejectedText("Ada");
    expect(text).toContain("Hi Ada,");
  });

  it("plain text is warm: not approved at this time, details kept", () => {
    const text = foundersRejectedText("Ada").toLowerCase();
    expect(text).toContain("at this time");
    expect(text).toContain("on file");
  });

  it("plain text carries no dashboard CTA (no approval link)", () => {
    const text = foundersRejectedText("Ada").toLowerCase();
    expect(text).not.toContain("dashboard");
    expect(text).not.toContain("http");
  });

  it("plain text carries no unsubscribe language (transactional, not marketing)", () => {
    expect(foundersRejectedText("Ada").toLowerCase()).not.toContain("unsubscribe");
  });

  it("falls back to a neutral greeting when no name is given", () => {
    const text = foundersRejectedText(null);
    expect(text).toContain("Hi,");
    expect(text).not.toContain("Hi ,");
  });
});
