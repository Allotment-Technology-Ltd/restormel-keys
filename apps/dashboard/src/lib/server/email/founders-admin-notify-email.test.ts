// @vitest-environment node
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  FOUNDERS_ADMIN_NOTIFY_SUBJECT,
  foundersAdminNotifyText,
} from "./founders-admin-notify-email";

// Pure-contract assertions only. The Svelte→HTML render path (buildFoundersAdminNotifyEmail with
// recipients) is NOT exercised here (browser-conditions gotcha — see founders-approved-email.test).
// We DO exercise the no-recipients short-circuit, which returns before any render.

describe("founders-admin-notify-email", () => {
  it("has a clear ops subject about a request needing review", () => {
    expect(FOUNDERS_ADMIN_NOTIFY_SUBJECT.toLowerCase()).toContain("founders circle");
    expect(FOUNDERS_ADMIN_NOTIFY_SUBJECT.toLowerCase()).toContain("review");
  });

  it("plain text carries the applicant name, email, and a review link", () => {
    const text = foundersAdminNotifyText("Ada Lovelace", "ada@example.com", "https://x/keys/admin/founders");
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("ada@example.com");
    expect(text).toContain("https://x/keys/admin/founders");
  });

  it("renders a dash for a missing applicant name", () => {
    const text = foundersAdminNotifyText(null, "ada@example.com", "https://x");
    expect(text).toContain("Name:  —");
  });

  describe("recipient resolution", () => {
    const ORIG = process.env.RESTORMEL_SERVICE_OWNER_EMAILS;
    beforeEach(() => vi.resetModules());
    afterEach(() => {
      if (ORIG === undefined) delete process.env.RESTORMEL_SERVICE_OWNER_EMAILS;
      else process.env.RESTORMEL_SERVICE_OWNER_EMAILS = ORIG;
    });

    it("returns null (no-op) when the admin-email env is explicitly blank", async () => {
      process.env.RESTORMEL_SERVICE_OWNER_EMAILS = "";
      const { buildFoundersAdminNotifyEmail } = await import("./founders-admin-notify-email");
      const env = buildFoundersAdminNotifyEmail({
        applicantEmail: "ada@example.com",
        applicantName: "Ada",
        reviewUrl: "https://x",
      });
      expect(env).toBeNull();
    });
  });
});
