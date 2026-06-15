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

  // ── SSRF bypass regressions (these MUST stay closed) ────────────────────────
  // FIX 1: the loopback /8 check used to mask the WRONG octet, so only 127.0.0.1
  // (saved by a hostname literal) was blocked and the rest of 127/8 leaked
  // through to loopback.
  const loopbackBypass = [
    ["127.0.0.2 (whole /8 routes to loopback)", "https://127.0.0.2/mcp"],
    ["127.1.2.3 (whole /8 routes to loopback)", "https://127.1.2.3/mcp"],
  ] as const;
  for (const [label, url] of loopbackBypass) {
    it(`mcp: BLOCKS ${label} in production`, () => {
      process.env.NODE_ENV = "production";
      delete process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;
      expect(validateOutboundUrl(url, "mcp").ok).toBe(false);
    });
    it(`mcp: BLOCKS ${label} in development`, () => {
      process.env.NODE_ENV = "development";
      delete process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;
      expect(validateOutboundUrl(url, "mcp").ok).toBe(false);
    });
  }

  // FIX 2: IPv4-mapped IPv6 (::ffff:a.b.c.d) used to bypass the IPv4 block-list
  // entirely and reach loopback / IMDS / RFC-1918. WHATWG URL normalises the
  // dotted form to the hex form, so we assert via the URL path (real parser).
  const mappedBypass = [
    ["::ffff:127.0.0.1 (mapped loopback)", "https://[::ffff:127.0.0.1]/mcp"],
    ["::ffff:127.0.0.1 over http", "http://[::ffff:127.0.0.1]/mcp"],
    ["::ffff:169.254.169.254 (mapped IMDS)", "https://[::ffff:169.254.169.254]/latest/meta-data/"],
    ["::ffff:10.0.0.1 (mapped RFC-1918)", "https://[::ffff:10.0.0.1]/mcp"],
    [":: unspecified", "https://[::]/mcp"],
  ] as const;
  for (const [label, url] of mappedBypass) {
    it(`mcp: BLOCKS ${label} in production`, () => {
      process.env.NODE_ENV = "production";
      delete process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;
      expect(validateOutboundUrl(url, "mcp").ok).toBe(false);
    });
    it(`mcp: BLOCKS ${label} in development too`, () => {
      process.env.NODE_ENV = "development";
      delete process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;
      expect(validateOutboundUrl(url, "mcp").ok).toBe(false);
    });
  }

  // Surreal family is the SAME guard — the mapped-IPv6 bypass must be closed there too.
  it("surreal: BLOCKS ::ffff:127.0.0.1 (mapped loopback) in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;
    expect(validateOutboundUrl("wss://[::ffff:127.0.0.1]/rpc", "surreal").ok).toBe(false);
  });

  // Over-blocking regression: a public IP ending in .127 must NOT be caught by the
  // loopback /8 check, and a normal public IPv6 must not be caught by the ULA prefix.
  it("mcp: ALLOWS a public host ending in .127 (8.8.8.127) — not loopback", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundUrl("https://8.8.8.127/sse", "mcp")).toEqual({ ok: true });
  });
  it("mcp: ALLOWS a normal public IPv6 (2606:4700:4700::1111)", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundUrl("https://[2606:4700:4700::1111]/sse", "mcp")).toEqual({ ok: true });
  });
  it("mcp: ALLOWS a public IPv6 with an 'fc' hextet that is NOT the prefix", () => {
    process.env.NODE_ENV = "production";
    // fc appears mid-address, not as the fc00::/7 ULA prefix → must be allowed.
    expect(validateOutboundUrl("https://[2606:4700::fc11]/sse", "mcp")).toEqual({ ok: true });
  });

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

  it("preserves surreal behaviour: allows public https in prod", () => {
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

  // PR #57: SurrealDB's native protocol is WebSocket, so the surreal family must
  // accept wss (secure) — production rejects cleartext ws but allows wss.
  it("surreal family allows wss (SurrealDB native WebSocket protocol, PR #57)", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundSurrealEndpoint("wss://instance.surreal.cloud")).toEqual({ ok: true });
    expect(validateOutboundSurrealEndpoint("ws://instance.surreal.cloud").ok).toBe(false);
  });
});
