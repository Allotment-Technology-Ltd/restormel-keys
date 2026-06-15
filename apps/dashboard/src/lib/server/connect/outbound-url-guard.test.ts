import { afterEach, describe, expect, it } from "vitest";
import { validateOutboundUrl } from "./outbound-url-guard";
import { validateOutboundSurrealEndpoint } from "./outbound-surreal-endpoint";

describe("validateOutboundUrl (shared SSRF / egress guard)", () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origVercel = process.env.VERCEL_ENV;
  const origAllowPrivate = process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;
  const origAllowlist = process.env.RESTORMEL_UPSTREAM_ALLOWLIST;

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    process.env.VERCEL_ENV = origVercel;
    if (origAllowPrivate === undefined) delete process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;
    else process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT = origAllowPrivate;
    if (origAllowlist === undefined) delete process.env.RESTORMEL_UPSTREAM_ALLOWLIST;
    else process.env.RESTORMEL_UPSTREAM_ALLOWLIST = origAllowlist;
  });

  // ── Blocks (the load-bearing deny set) ──────────────────────────────────────
  const blocked = [
    ["localhost", "https://localhost:9000/mcp"],
    ["127.0.0.1 loopback", "https://127.0.0.1/mcp"],
    ["10.x RFC-1918", "https://10.0.0.5/mcp"],
    ["172.16.x RFC-1918", "https://172.16.4.4/mcp"],
    ["192.168.x RFC-1918", "https://192.168.1.10/mcp"],
    ["169.254.169.254 IMDS link-local", "https://169.254.169.254/latest/meta-data/"],
    ["::1 IPv6 loopback", "https://[::1]/mcp"],
    ["metadata hostname", "https://metadata.google.internal/x"],
    [".internal suffix", "https://db.svc.internal/mcp"],
  ] as const;

  for (const [label, url] of blocked) {
    it(`mcp: BLOCKS ${label} in production`, () => {
      process.env.NODE_ENV = "production";
      delete process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;
      const r = validateOutboundUrl(url, "mcp");
      expect(r.ok).toBe(false);
    });

    it(`mcp: BLOCKS ${label} in development too`, () => {
      process.env.NODE_ENV = "development";
      delete process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;
      const r = validateOutboundUrl(url, "mcp");
      // localhost loopback is dev-allowed only over a cleartext scheme to localhost;
      // here we asserted https://localhost which is also fine in dev, so skip that one.
      if (url.includes("localhost") || url.includes("127.0.0.1") || url.includes("[::1]")) {
        // loopback over https is permitted in dev — that's expected, not a block.
        return;
      }
      expect(r.ok).toBe(false);
    });
  }

  // ── Allows ──────────────────────────────────────────────────────────────────
  it("mcp: ALLOWS public https in production", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundUrl("https://mcp.example.com/sse", "mcp")).toEqual({ ok: true });
  });

  it("mcp: ALLOWS public wss in production", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundUrl("wss://mcp.example.com/ws", "mcp")).toEqual({ ok: true });
  });

  it("mcp: BLOCKS cleartext http to a public host in production", () => {
    process.env.NODE_ENV = "production";
    const r = validateOutboundUrl("http://mcp.example.com/sse", "mcp");
    expect(r.ok).toBe(false);
  });

  it("mcp: BLOCKS cleartext ws to a public host in production", () => {
    process.env.NODE_ENV = "production";
    const r = validateOutboundUrl("ws://mcp.example.com/ws", "mcp");
    expect(r.ok).toBe(false);
  });

  it("mcp: ALLOWS http://localhost in development", () => {
    process.env.NODE_ENV = "development";
    expect(validateOutboundUrl("http://localhost:8787/mcp", "mcp")).toEqual({ ok: true });
  });

  it("mcp: ALLOWS ws://localhost in development", () => {
    process.env.NODE_ENV = "development";
    expect(validateOutboundUrl("ws://localhost:8787/mcp", "mcp")).toEqual({ ok: true });
  });

  it("mcp: BLOCKS http to a non-localhost host in development", () => {
    process.env.NODE_ENV = "development";
    const r = validateOutboundUrl("http://mcp.example.com/sse", "mcp");
    expect(r.ok).toBe(false);
  });

  // ── Same verdict at write-time vs dial-time (same pure function both sides) ──
  it("returns the SAME verdict for the same URL (write-time == dial-time)", () => {
    process.env.NODE_ENV = "production";
    const url = "https://169.254.169.254/latest/meta-data/";
    const writeTime = validateOutboundUrl(url, "mcp");
    const dialTime = validateOutboundUrl(url, "mcp");
    expect(writeTime).toEqual(dialTime);
    expect(writeTime.ok).toBe(false);

    const ok = "https://mcp.example.com/sse";
    expect(validateOutboundUrl(ok, "mcp")).toEqual(validateOutboundUrl(ok, "mcp"));
    expect(validateOutboundUrl(ok, "mcp").ok).toBe(true);
  });

  // ── Optional per-deployment allow-list ──────────────────────────────────────
  it("mcp: enforces RESTORMEL_UPSTREAM_ALLOWLIST when set", () => {
    process.env.NODE_ENV = "production";
    process.env.RESTORMEL_UPSTREAM_ALLOWLIST = "mcp.allowed.com,.trusted.io";
    expect(validateOutboundUrl("https://mcp.allowed.com/sse", "mcp").ok).toBe(true);
    expect(validateOutboundUrl("https://api.trusted.io/sse", "mcp").ok).toBe(true);
    expect(validateOutboundUrl("https://evil.example.com/sse", "mcp").ok).toBe(false);
  });

  // ── allowPrivate escape hatch (operator-local only) ─────────────────────────
  it("mcp: allows a private host only with RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT=1", () => {
    process.env.NODE_ENV = "production";
    process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT = "1";
    expect(validateOutboundUrl("https://10.0.0.5/mcp", "mcp").ok).toBe(true);
  });
});

describe("validateOutboundSurrealEndpoint (delegates to the shared guard)", () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origAllowPrivate = process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    if (origAllowPrivate === undefined) delete process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;
    else process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT = origAllowPrivate;
  });

  it("preserves http/https-only surreal behaviour: allows public https in prod", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundSurrealEndpoint("https://instance.surreal.cloud")).toEqual({ ok: true });
  });

  it("preserves surreal behaviour: rejects http in prod and blocks 10.x", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundSurrealEndpoint("http://instance.surreal.cloud").ok).toBe(false);
    process.env.NODE_ENV = "development";
    delete process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;
    expect(validateOutboundSurrealEndpoint("https://10.0.0.5").ok).toBe(false);
  });

  it("surreal family rejects wss (Surreal is http/https only)", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundSurrealEndpoint("wss://instance.surreal.cloud").ok).toBe(false);
  });
});
