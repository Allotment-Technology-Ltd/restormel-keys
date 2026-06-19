// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { resolveMailIdentity } from "./send-mail";
import { securityAlertEmailText } from "./security-alert-email";

// Assert the stable, pure contract: plain-text body and the security mailbox identity.
//
// Identity after Migadu 553 fix:
//   From     = send.-owned address with "Restormel Security" display name
//              (NOT admin@restormel.dev — Migadu 553 5.7.1 cross-domain rejection)
//   Reply-To = admin@restormel.dev (no sender ownership required)
//
// The Svelte→HTML render (buildSecurityAlertEmail) is intentionally NOT exercised here:
// this vitest project sets `resolve.conditions: ["browser"]`, which is incompatible
// with `svelte/server` render. Server render is verified at SvelteKit runtime.
const ACTION_URL = "https://restormel.dev/keys/dashboard/admin/review";

vi.mock("$env/dynamic/private", () => ({
  env: {
    // No SECURITY_EMAIL_FROM / SECURITY_EMAIL_REPLY_TO → defaults apply.
  },
}));

describe("security-alert-email", () => {
  it("is sent From a send.-owned address (not admin@) with Reply-To=admin@", () => {
    // Migadu 553 fix: the SMTP user (notify@send.restormel.dev) must own the From domain.
    // Reply-To routes replies to the admin inbox without requiring sender ownership.
    const id = resolveMailIdentity("security");
    expect(id.from).toContain("Restormel Security");
    expect(id.from).not.toContain("admin@restormel.dev");
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
