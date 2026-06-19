// @vitest-environment node
import { describe, it, expect } from "vitest";
import { maskEmail, sanitiseErrorReason } from "./email-send-log";

// Pure helpers only — the DB-backed record/lookup functions are exercised at runtime against
// Postgres, not here. The masking + sanitisation are the PII-critical bits and are fully pure.

describe("maskEmail", () => {
  it("masks a normal address keeping a 2-char local head + 1-char domain head + tld", () => {
    expect(maskEmail("ada.lovelace@example.com")).toBe("ad***@e***.com");
  });

  it("masks a short single-char local part", () => {
    expect(maskEmail("x@y.io")).toBe("x***@y***.io");
  });

  it("never leaks the full local part or full domain", () => {
    const masked = maskEmail("administrator@enterprise.co.uk");
    expect(masked).not.toContain("administrator");
    expect(masked).not.toContain("enterprise");
    expect(masked.startsWith("ad***@")).toBe(true);
    expect(masked.endsWith(".uk")).toBe(true);
  });

  it("returns *** for empty / malformed input (no @)", () => {
    expect(maskEmail("")).toBe("***");
    expect(maskEmail(null)).toBe("***");
    expect(maskEmail("not-an-email")).toBe("***");
  });
});

describe("sanitiseErrorReason", () => {
  it("collapses whitespace/newlines and truncates to a short token", () => {
    const reason = sanitiseErrorReason("ECONNREFUSED\n  connect 127.0.0.1:587");
    expect(reason).not.toContain("\n");
    expect(reason.length).toBeLessThanOrEqual(60);
    expect(reason).toContain("ECONNREFUSED");
  });

  it("falls back to 'unknown' for null/empty", () => {
    expect(sanitiseErrorReason(null)).toBe("unknown");
    expect(sanitiseErrorReason("")).toBe("unknown");
    expect(sanitiseErrorReason(undefined)).toBe("unknown");
  });

  it("caps overly-long reasons at 60 chars (no PII bleed via a giant message)", () => {
    const long = "x".repeat(500);
    expect(sanitiseErrorReason(long).length).toBe(60);
  });
});
