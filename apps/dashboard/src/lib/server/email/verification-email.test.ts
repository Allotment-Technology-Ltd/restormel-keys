// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resolveMailIdentity } from "./send-mail";
import { VERIFICATION_EMAIL_SUBJECT, verificationEmailText } from "./verification-email";

// Assert the stable, pure contract: subject, plain-text body, and the transactional
// mailbox identity (notify@ From, contact@ Reply-To).
//
// The Svelte→HTML render (buildVerificationEmail) is intentionally NOT exercised here:
// this vitest project sets `resolve.conditions: ["browser"]`, which is incompatible
// with `svelte/server` render. Server render is verified at SvelteKit runtime.
const VERIFY_URL = "https://restormel.dev/keys/dashboard/api/auth/verify-email?token=test123";

describe("verification-email", () => {
  it("is sent on the transactional identity (notify@ From, contact@ Reply-To)", () => {
    const id = resolveMailIdentity("transactional");
    expect(id.from).toContain("notify@restormel.dev");
    expect(id.replyTo).toBe("contact@restormel.dev");
  });

  it("has a clear subject referencing email verification", () => {
    expect(VERIFICATION_EMAIL_SUBJECT.toLowerCase()).toContain("verify");
  });

  it("plain text includes the verify URL", () => {
    const text = verificationEmailText(VERIFY_URL);
    expect(text).toContain(VERIFY_URL);
  });

  it("plain text includes safe-to-ignore reassurance", () => {
    const text = verificationEmailText(VERIFY_URL);
    expect(text.toLowerCase()).toContain("ignore");
  });

  it("plain text carries no unsubscribe language (transactional, not marketing)", () => {
    expect(verificationEmailText(VERIFY_URL).toLowerCase()).not.toContain("unsubscribe");
  });
});
