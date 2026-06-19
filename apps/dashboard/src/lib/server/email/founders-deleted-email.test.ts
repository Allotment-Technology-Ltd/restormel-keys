// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resolveMailIdentity } from "./send-mail";
import { FOUNDERS_DELETED_SUBJECT, foundersDeletedText } from "./founders-deleted-email";

// Pure-contract assertions only. The Svelte→HTML render (buildFoundersDeletedEmail) is NOT
// exercised here: this vitest project sets `resolve.conditions: ["browser"]`, which is
// incompatible with `svelte/server` render. The server render is verified separately and runs
// correctly under SvelteKit's server conditions at runtime.

describe("founders-deleted-email", () => {
  it("is sent on the transactional identity (notify@ From, contact@ Reply-To)", () => {
    const id = resolveMailIdentity("transactional");
    expect(id.from).toContain("notify@");
    expect(id.replyTo).toBe("contact@restormel.dev");
  });

  it("has a clear, on-brand subject about removal", () => {
    expect(FOUNDERS_DELETED_SUBJECT.toLowerCase()).toContain("founders circle");
    expect(FOUNDERS_DELETED_SUBJECT.toLowerCase()).toContain("removed");
  });

  it("plain text includes the personalised greeting", () => {
    const text = foundersDeletedText("Ada");
    expect(text).toContain("Hi Ada,");
  });

  it("plain text is neutral/administrative and GDPR-friendly (details removed, contact us)", () => {
    const text = foundersDeletedText("Ada").toLowerCase();
    expect(text).toContain("removed from our system");
    expect(text).toContain("contact@restormel.dev");
  });

  it("plain text carries no dashboard CTA", () => {
    const text = foundersDeletedText("Ada").toLowerCase();
    expect(text).not.toContain("dashboard");
  });

  it("plain text carries no unsubscribe language (transactional, not marketing)", () => {
    expect(foundersDeletedText("Ada").toLowerCase()).not.toContain("unsubscribe");
  });

  it("falls back to a neutral greeting when no name is given", () => {
    const text = foundersDeletedText(null);
    expect(text).toContain("Hi,");
    expect(text).not.toContain("Hi ,");
  });
});
