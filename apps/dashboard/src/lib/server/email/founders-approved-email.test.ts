// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resolveMailIdentity } from "./send-mail";
import { FOUNDERS_APPROVED_SUBJECT, foundersApprovedText } from "./founders-approved-email";

// These assert the stable, pure contract — subject, plain-text body, the transactional
// "no unsubscribe" invariant, and the transactional mailbox identity.
//
// The Svelte→HTML render (buildFoundersApprovedEmail) is intentionally NOT exercised here:
// this vitest project sets `resolve.conditions: ["browser"]` (for @testing-library client
// tests), which is incompatible with `svelte/server` render. The server render is verified
// separately and runs correctly under SvelteKit's server conditions at runtime.
const URL = "https://restormel.dev/keys/dashboard";

describe("founders-approved-email", () => {
  it("is sent on the transactional identity (notify@ From, contact@ Reply-To)", () => {
    const id = resolveMailIdentity("transactional");
    expect(id.from).toContain("notify@restormel.dev");
    expect(id.replyTo).toBe("contact@restormel.dev");
  });

  it("has a clear, non-marketing subject", () => {
    expect(FOUNDERS_APPROVED_SUBJECT.toLowerCase()).toContain("approved");
  });

  it("plain text includes the personalised greeting and dashboard link", () => {
    const text = foundersApprovedText("Ada", URL);
    expect(text).toContain("Hi Ada,");
    expect(text).toContain(URL);
  });

  it("plain text carries no unsubscribe language (transactional, not marketing)", () => {
    expect(foundersApprovedText("Ada", URL).toLowerCase()).not.toContain("unsubscribe");
  });

  it("falls back to a neutral greeting when no name is given", () => {
    const text = foundersApprovedText(null, URL);
    expect(text).toContain("Hi,");
    expect(text).not.toContain("Hi ,");
  });
});
