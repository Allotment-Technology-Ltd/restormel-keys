// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resolveMailIdentity } from "./send-mail";
import { securityAlertEmailText } from "./security-alert-email";

// Assert the stable, pure contract: plain-text body and the security mailbox identity
// (admin@ From and Reply-To — unambiguous operator inbox).
//
// The Svelte→HTML render (buildSecurityAlertEmail) is intentionally NOT exercised here:
// this vitest project sets `resolve.conditions: ["browser"]`, which is incompatible
// with `svelte/server` render. Server render is verified at SvelteKit runtime.
const ACTION_URL = "https://restormel.dev/keys/dashboard/admin/review";

describe("security-alert-email", () => {
  it("is sent on the security identity (admin@ From and Reply-To)", () => {
    const id = resolveMailIdentity("security");
    expect(id.from).toBe("admin@restormel.dev");
    expect(id.replyTo).toBe("admin@restormel.dev");
  });

  it("plain text includes the heading and message", () => {
    const text = securityAlertEmailText("Suspicious login", "A sign-in was detected from an unknown device.", ACTION_URL);
    expect(text).toContain("Suspicious login");
    expect(text).toContain("A sign-in was detected from an unknown device.");
  });

  it("plain text includes the actionUrl when provided", () => {
    const text = securityAlertEmailText("Alert", "Something happened.", ACTION_URL);
    expect(text).toContain(ACTION_URL);
  });

  it("plain text omits actionUrl section when not provided", () => {
    const text = securityAlertEmailText("Alert", "Something happened.");
    expect(text).not.toContain("Review now:");
    expect(text).not.toContain("https://");
  });

  it("plain text carries no unsubscribe language (operational notice, not marketing)", () => {
    const text = securityAlertEmailText("Alert", "Something happened.", ACTION_URL);
    expect(text.toLowerCase()).not.toContain("unsubscribe");
  });

  it("plain text flags the security alert label", () => {
    const text = securityAlertEmailText("Test heading", "Test message.");
    expect(text.toLowerCase()).toContain("security alert");
  });
});
