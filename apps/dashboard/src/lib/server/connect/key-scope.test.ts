/**
 * RES-113 PR-L — enforced key-scope decision tests (env-independent, no DB / LLM / secrets).
 *
 * Proves the security-load-bearing rule: a READ key cannot write memory; a READ+WRITE key can;
 * legacy unscoped keys are grandfathered; and with the onboardingJourney flag OFF, nothing is
 * enforced (today's behaviour is preserved byte-for-byte).
 */
import { describe, expect, it } from "vitest";
import {
  decideMemoryWriteScope,
  isValidAccess,
  isValidConnectionType,
  normalizeAccess,
  normalizeConnectionType,
  normalizeTarget,
  writeScopeDenialMessage,
  MEMORY_WRITE_REQUIRED_ACCESS,
  KEY_TARGET_MAX_LENGTH,
} from "./key-scope";

describe("validators", () => {
  it("accepts only mcp/rest as connection types", () => {
    expect(isValidConnectionType("mcp")).toBe(true);
    expect(isValidConnectionType("rest")).toBe(true);
    for (const bad of ["widget", "sdk", "graphql", "MCP", "", null, undefined, 1, {}]) {
      expect(isValidConnectionType(bad)).toBe(false);
    }
  });

  it("accepts only read/read_write as access", () => {
    expect(isValidAccess("read")).toBe(true);
    expect(isValidAccess("read_write")).toBe(true);
    for (const bad of ["write", "readwrite", "read+write", "admin", "", null, undefined]) {
      expect(isValidAccess(bad)).toBe(false);
    }
  });

  it("normalises untrusted input to a valid value or null (never throws)", () => {
    expect(normalizeConnectionType("rest")).toBe("rest");
    expect(normalizeConnectionType("widget")).toBeNull();
    expect(normalizeConnectionType(42)).toBeNull();
    expect(normalizeAccess("read_write")).toBe("read_write");
    expect(normalizeAccess("superuser")).toBeNull();
    expect(normalizeAccess(undefined)).toBeNull();
  });

  it("normalises a target: trims, caps, empty→null", () => {
    expect(normalizeTarget("  ws-123  ")).toBe("ws-123");
    expect(normalizeTarget("   ")).toBeNull();
    expect(normalizeTarget(123)).toBeNull();
    const long = "x".repeat(KEY_TARGET_MAX_LENGTH + 50);
    expect(normalizeTarget(long)?.length).toBe(KEY_TARGET_MAX_LENGTH);
  });
});

describe("decideMemoryWriteScope — flag OFF (today's behaviour preserved)", () => {
  it("ALLOWS every key when the onboardingJourney flag is OFF, regardless of access", () => {
    for (const access of ["read", "read_write", null, undefined] as const) {
      const d = decideMemoryWriteScope({
        authType: "gateway_key",
        access,
        flagEnabled: false,
      });
      expect(d.allowed).toBe(true);
      expect(d.reason).toBe("flag_off_unscoped");
    }
  });

  it("ALLOWS a read key with flag OFF (the enforcement only exists under the flag)", () => {
    const d = decideMemoryWriteScope({ authType: "gateway_key", access: "read", flagEnabled: false });
    expect(d.allowed).toBe(true);
  });
});

describe("decideMemoryWriteScope — flag ON (enforced)", () => {
  it("DENIES a read-scoped gateway key", () => {
    const d = decideMemoryWriteScope({ authType: "gateway_key", access: "read", flagEnabled: true });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("read_scope_denied");
  });

  it("ALLOWS a read+write gateway key", () => {
    const d = decideMemoryWriteScope({
      authType: "gateway_key",
      access: "read_write",
      flagEnabled: true,
    });
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe("read_write_scope");
  });

  it("GRANDFATHERS a legacy (NULL access) gateway key as read+write", () => {
    for (const access of [null, undefined] as const) {
      const d = decideMemoryWriteScope({ authType: "gateway_key", access, flagEnabled: true });
      expect(d.allowed).toBe(true);
      expect(d.reason).toBe("legacy_unscoped_grandfathered");
    }
  });

  it("DENIES a revoked key even if read+write", () => {
    const d = decideMemoryWriteScope({
      authType: "gateway_key",
      access: "read_write",
      status: "revoked",
      flagEnabled: true,
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("revoked_key_denied");
  });

  it("does NOT narrow non-gateway auth (session owner / management admin keep write)", () => {
    for (const authType of ["session", "management_key"] as const) {
      const d = decideMemoryWriteScope({ authType, access: "read", flagEnabled: true });
      expect(d.allowed).toBe(true);
      expect(d.reason).toBe("non_gateway_auth");
    }
  });

  it("read access is exactly the inverse of read+write for a gateway key (no third allow path)", () => {
    const read = decideMemoryWriteScope({ authType: "gateway_key", access: "read", flagEnabled: true });
    const rw = decideMemoryWriteScope({
      authType: "gateway_key",
      access: MEMORY_WRITE_REQUIRED_ACCESS,
      flagEnabled: true,
    });
    expect(read.allowed).toBe(false);
    expect(rw.allowed).toBe(true);
  });
});

describe("writeScopeDenialMessage", () => {
  it("returns a read-only message for a read denial, never key material", () => {
    const msg = writeScopeDenialMessage({ allowed: false, reason: "read_scope_denied" });
    expect(msg).toMatch(/read-only/i);
    expect(msg).not.toMatch(/rk_/);
  });

  it("returns a revoked message for a revoked denial", () => {
    const msg = writeScopeDenialMessage({ allowed: false, reason: "revoked_key_denied" });
    expect(msg).toMatch(/revoked/i);
  });
});
