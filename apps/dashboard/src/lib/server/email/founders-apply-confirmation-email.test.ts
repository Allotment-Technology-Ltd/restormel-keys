// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resolveMailIdentity } from "./send-mail";
import {
  FOUNDERS_APPLY_CONFIRMATION_SUBJECT,
  foundersApplyConfirmationText,
} from "./founders-apply-confirmation-email";

// Pure-contract assertions only. The Svelte→HTML render (buildFoundersApplyConfirmationEmail)
// is NOT exercised here: this vitest project sets `resolve.conditions: ["browser"]`, which is
// incompatible with `svelte/server` render. The server render is verified separately and runs
// correctly under SvelteKit's server conditions at runtime.
const DOCS = "https://restormel.dev/keys/docs";

describe("founders-apply-confirmation-email", () => {
  it("is sent on the transactional identity (notify@ From, contact@ Reply-To)", () => {
    const id = resolveMailIdentity("transactional");
    expect(id.from).toContain("notify@");
    expect(id.replyTo).toBe("contact@restormel.dev");
  });

  it("has a clear, on-brand subject about the recorded request", () => {
    expect(FOUNDERS_APPLY_CONFIRMATION_SUBJECT.toLowerCase()).toContain("founders circle");
    expect(FOUNDERS_APPLY_CONFIRMATION_SUBJECT.toLowerCase()).toContain("recorded");
  });

  it("plain text includes the personalised greeting and the docs/demo link", () => {
    const text = foundersApplyConfirmationText("Ada", DOCS);
    expect(text).toContain("Hi Ada,");
    expect(text).toContain(DOCS);
  });

  it("plain text carries the honest verified-context marketing moment", () => {
    const text = foundersApplyConfirmationText("Ada", DOCS).toLowerCase();
    expect(text).toContain("verified context");
    // honest framing — "live today", not aspirational
    expect(text).toContain("live today");
  });

  it("plain text carries no unsubscribe language (transactional, not marketing)", () => {
    expect(foundersApplyConfirmationText("Ada", DOCS).toLowerCase()).not.toContain("unsubscribe");
  });

  it("falls back to a neutral greeting when no name is given", () => {
    const text = foundersApplyConfirmationText(null, DOCS);
    expect(text).toContain("Hi,");
    expect(text).not.toContain("Hi ,");
  });
});
