/**
 * connectUpstreamHttp — hermetic unit tests (W2-1, issue #96).
 *
 * Tests the inline SSRF guard enforcement and URL-validation path. No real HTTP server is
 * started; the guard runs synchronously before any transport is constructed, so these tests
 * are fast (~0 ms network I/O) and hermetic (no keys, no network, no external processes).
 *
 * The live HTTP round-trip (connectUpstreamHttp → mode1-http-server.ts → verifyEnvelope) is
 * covered by the reference runner:
 *   pnpm exec tsx scripts/reviews/verifying-proxy-reference.ts --upstream http://localhost:3741/mcp
 */
import { describe, expect, it } from "vitest";
import { connectUpstreamHttp, UpstreamCallError } from "../client.js";

/**
 * Helper: call connectUpstreamHttp with the URL under test and a guard override that
 * delegates to the real inline guard. We capture the rejection without waiting for a
 * network timeout.
 */
async function expectGuardRejects(url: string): Promise<UpstreamCallError> {
  try {
    await connectUpstreamHttp(url);
    throw new Error(`Expected connectUpstreamHttp("${url}") to throw, but it did not`);
  } catch (err) {
    if (err instanceof UpstreamCallError) return err;
    throw err;
  }
}

describe("connectUpstreamHttp — inline SSRF guard enforcement (hermetic)", () => {
  it("rejects private IPv4 addresses (RFC-1918 192.168.x.x)", async () => {
    const err = await expectGuardRejects("https://192.168.1.1/mcp");
    expect(err.message).toContain("SSRF guard rejected");
    expect(err.kind).toBe("transport");
  });

  it("rejects 10.0.0.0/8 block", async () => {
    const err = await expectGuardRejects("https://10.0.0.1/mcp");
    expect(err.message).toContain("SSRF guard rejected");
  });

  it("rejects 172.16.0.0/12 block", async () => {
    const err = await expectGuardRejects("https://172.16.5.5/mcp");
    expect(err.message).toContain("SSRF guard rejected");
  });

  it("rejects cloud IMDS address 169.254.169.254", async () => {
    const err = await expectGuardRejects("https://169.254.169.254/latest/meta-data/");
    expect(err.message).toContain("SSRF guard rejected");
  });

  it("rejects *.internal hostnames", async () => {
    const err = await expectGuardRejects("https://metadata.internal/mcp");
    expect(err.message).toContain("SSRF guard rejected");
  });

  it("rejects non-http/https schemes", async () => {
    const err = await expectGuardRejects("ftp://example.com/mcp");
    expect(err.message).toContain("SSRF guard rejected");
  });

  it("rejects cleartext http:// for non-loopback hosts in dev (guard semantics)", async () => {
    // The guard: http:// non-loopback non-prod → rejected ("use https for remote hosts").
    const err = await expectGuardRejects("http://example.com/mcp");
    expect(err.message).toContain("SSRF guard rejected");
  });

  it("throws UpstreamCallError with kind=transport on SSRF guard rejection", async () => {
    const err = await expectGuardRejects("https://192.168.99.99/mcp");
    expect(err).toBeInstanceOf(UpstreamCallError);
    expect(err.kind).toBe("transport");
  });

  it("rejects invalid URLs (non-parseable)", async () => {
    const err = await expectGuardRejects("not-a-url");
    expect(err).toBeInstanceOf(UpstreamCallError);
    expect(err.kind).toBe("transport");
  });

  it("accepts localhost in dev — guard passes, only connection fails (ECONNREFUSED)", async () => {
    // In dev, http://localhost is allowed by the guard (loopback exception).
    // The transport will attempt a real connection and fail with a network error —
    // NOT an SSRF guard rejection. We confirm the error is not a guard message.
    // Use port 19999 which is almost certainly not in use.
    try {
      await connectUpstreamHttp("http://localhost:19999/mcp");
      // If it somehow succeeded (nothing should be listening), that's unexpected but not fatal.
    } catch (err) {
      if (err instanceof UpstreamCallError) {
        // If it IS an UpstreamCallError, it must be a transport/connection error, not SSRF.
        expect(err.message).not.toContain("SSRF guard rejected");
      }
      // Other non-UpstreamCallError errors (e.g. ECONNREFUSED Node error) are expected.
    }
  });

  it("guard accepts a custom inject validator (injectable override)", async () => {
    // The _guard parameter lets operator tooling override the SSRF policy.
    // A guard that always REJECTS should block any URL immediately (synchronous, no network I/O).
    const alwaysReject = (_url: string) => ({ ok: false as const, message: "custom-policy-reject" });
    try {
      await connectUpstreamHttp("https://example.com/mcp", alwaysReject);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(UpstreamCallError);
      // The error message should reference the custom-policy message from the injected guard.
      expect((err as UpstreamCallError).message).toContain("custom-policy-reject");
    }
  });
});
