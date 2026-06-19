// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resolveMailIdentity } from "./send-mail";
import { PASSWORD_RESET_EMAIL_SUBJECT, passwordResetEmailText } from "./password-reset-email";

// Assert the stable, pure contract: subject, plain-text body, and the transactional
// mailbox identity (notify@ From, contact@ Reply-To).
//
// The Svelte→HTML render (buildPasswordResetEmail) is intentionally NOT exercised here:
// this vitest project sets `resolve.conditions: ["browser"]`, which is incompatible
// with `svelte/server` render. Server render is verified at SvelteKit runtime.
const RESET_URL = "https://restormel.dev/keys/dashboard/api/auth/reset-password?token=test456";

describe("password-reset-email", () => {
  it("is sent on the transactional identity (notify@ From, contact@ Reply-To)", () => {
    const id = resolveMailIdentity("transactional");
    expect(id.from).toContain("notify@restormel.dev");
    expect(id.replyTo).toBe("contact@restormel.dev");
  });

  it("has a clear subject referencing password reset", () => {
    expect(PASSWORD_RESET_EMAIL_SUBJECT.toLowerCase()).toContain("reset");
    expect(PASSWORD_RESET_EMAIL_SUBJECT.toLowerCase()).toContain("password");
  });

  it("plain text includes the reset URL", () => {
    const text = passwordResetEmailText(RESET_URL);
    expect(text).toContain(RESET_URL);
  });

  it("plain text mentions the 1-hour expiry", () => {
    const text = passwordResetEmailText(RESET_URL);
    expect(text).toContain("1 hour");
  });

  it("plain text reassures the user their password won't change if ignored", () => {
    const text = passwordResetEmailText(RESET_URL);
    expect(text.toLowerCase()).toContain("ignore");
  });

  it("plain text carries no unsubscribe language (transactional, not marketing)", () => {
    expect(passwordResetEmailText(RESET_URL).toLowerCase()).not.toContain("unsubscribe");
  });
});
