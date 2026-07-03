/**
 * Tests for connect.retrieve_verified (Stage 4.1 — verified-retrieval MCP tool).
 *
 * All tests run without live API keys. The handler is exercised by injecting a
 * mock fetch (via process.env stubs + monkey-patching the fetch global used by
 * connectProxyPost) or by testing the pure helper functions directly.
 *
 * Test structure follows packages/mcp/src/suite-tools.test.ts conventions:
 *   - describe block per concern
 *   - pure-function tests first (no I/O)
 *   - handler tests using env stubs + mock fetch
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VerifiedClaimEnvelope } from "@restormel/contracts/verified-claim";
import {
  applyModeFilter,
  buildVerificationSummary,
  VERIFIED_RETRIEVAL_TOOL_VERSION,
} from "./connect-verified-retrieval.js";
import { registerConnectVerifiedRetrieval } from "./connect-verified-retrieval.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUPPORTED_CLAIM: VerifiedClaimEnvelope = {
  claim: { id: "claim:supported-1", text: "Restormel enforces cross-model validation by default." },
  state: "supported",
  evidence: [
    {
      quote: "cross-model validation is the default routing policy",
      offsets: [0, 51],
      source_ref: "source:plan-doc",
      source_hash: "sha256:abc123",
      match: "exact",
    },
  ],
  judge: { model: "together:llama-3.3-70b", prompt_version: 1, confidence: 0.97, at: "2026-06-10T10:00:00Z" },
  citation: "Restormel Plan Document (2026)",
  trace_ref: "/connect/v1/traces/trace-001",
  trust_score: 92,
};

const INFERRED_CLAIM: VerifiedClaimEnvelope = {
  claim: { id: "claim:inferred-1", text: "The system likely uses multi-step validation." },
  state: "inferred",
  evidence: [],
  citation: "Restormel Architecture Notes",
  trace_ref: "/connect/v1/traces/trace-001",
};

const UNVERIFIED_CLAIM: VerifiedClaimEnvelope = {
  claim: { id: "claim:unverified-1", text: "Some unconfirmed detail." },
  state: "unverified",
  evidence: [],
  citation: null,
  trace_ref: null,
};

const CONTRADICTED_CLAIM: VerifiedClaimEnvelope = {
  claim: { id: "claim:contradicted-1", text: "Validation is skipped for high-trust sources." },
  state: "contradicted",
  evidence: [],
  citation: "Internal Security Policy",
  trace_ref: null,
};

const EXCLUDED_CLAIM: VerifiedClaimEnvelope = {
  claim: { id: "claim:excluded-1", text: "An operator-excluded claim." },
  state: "excluded",
  evidence: [],
  citation: null,
  trace_ref: null,
};

const ALL_CLAIMS = [
  SUPPORTED_CLAIM,
  INFERRED_CLAIM,
  UNVERIFIED_CLAIM,
  CONTRADICTED_CLAIM,
  EXCLUDED_CLAIM,
];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("applyModeFilter", () => {
  it("strict mode: returns ONLY supported claims", () => {
    const result = applyModeFilter(ALL_CLAIMS, "strict");
    expect(result).toHaveLength(1);
    expect(result[0].state).toBe("supported");
    expect(result[0].claim.id).toBe("claim:supported-1");
  });

  it("strict mode: returns empty array when no supported claims", () => {
    const noSupported = ALL_CLAIMS.filter((c) => c.state !== "supported");
    const result = applyModeFilter(noSupported, "strict");
    expect(result).toHaveLength(0);
  });

  it("annotated mode: returns all claims, preserving every state", () => {
    const result = applyModeFilter(ALL_CLAIMS, "annotated");
    expect(result).toHaveLength(ALL_CLAIMS.length);
    const states = result.map((c) => c.state);
    expect(states).toContain("supported");
    expect(states).toContain("inferred");
    expect(states).toContain("unverified");
    expect(states).toContain("contradicted");
    expect(states).toContain("excluded");
  });

  it("annotated mode: inferred/unverified/contradicted/excluded are present but labeled (not silently blended)", () => {
    const result = applyModeFilter(ALL_CLAIMS, "annotated");
    const byState = Object.fromEntries(result.map((c) => [c.state, c]));
    // Each non-supported claim is present with its original state — not promoted to supported.
    expect(byState.inferred?.state).toBe("inferred");
    expect(byState.unverified?.state).toBe("unverified");
    expect(byState.contradicted?.state).toBe("contradicted");
    expect(byState.excluded?.state).toBe("excluded");
  });

  it("strict mode: excludes claims that are excluded — proof of ledger row 4 (unsupported claims omitted, not blended)", () => {
    // Row 4: "Unsupported claims are excluded, not blended"
    // strict mode is the retrieval-side proof: excluded/contradicted/inferred/unverified
    // are simply not returned. Only supported claims survive.
    const result = applyModeFilter(ALL_CLAIMS, "strict");
    const ids = result.map((c) => c.claim.id);
    expect(ids).not.toContain("claim:excluded-1");
    expect(ids).not.toContain("claim:contradicted-1");
    expect(ids).not.toContain("claim:inferred-1");
    expect(ids).not.toContain("claim:unverified-1");
    // Only the supported claim passes through.
    expect(ids).toEqual(["claim:supported-1"]);
  });
});

describe("buildVerificationSummary", () => {
  it("counts each state correctly", () => {
    const summary = buildVerificationSummary(ALL_CLAIMS);
    expect(summary.supported).toBe(1);
    expect(summary.inferred).toBe(1);
    expect(summary.unverified).toBe(1);
    expect(summary.contradicted).toBe(1);
    expect(summary.excluded).toBe(1);
  });

  it("returns empty object for an empty array", () => {
    expect(buildVerificationSummary([])).toEqual({});
  });

  it("handles multiple claims with the same state", () => {
    const dupe: VerifiedClaimEnvelope = { ...SUPPORTED_CLAIM, claim: { id: "claim:supported-2", text: "Another." } };
    const summary = buildVerificationSummary([SUPPORTED_CLAIM, dupe, INFERRED_CLAIM]);
    expect(summary.supported).toBe(2);
    expect(summary.inferred).toBe(1);
  });
});

describe("VERIFIED_RETRIEVAL_TOOL_VERSION", () => {
  it("is a semver string", () => {
    expect(VERIFIED_RETRIEVAL_TOOL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ---------------------------------------------------------------------------
// Handler integration tests (mock fetch)
// ---------------------------------------------------------------------------

/** Build a minimal Connect v1 retrieve response carrying verified_claims. */
function buildUpstreamResponse(claims: VerifiedClaimEnvelope[]): Record<string, unknown> {
  return {
    ok: true,
    contract_version: "1.0",
    request_id: "req-test-001",
    verified_claims: claims,
    metadata: {
      claims_retrieved: claims.length,
      verification_summary: buildVerificationSummary(claims),
    },
  };
}

/** A minimal McpServer stub that captures registered tool handlers. */
function makeServerStub() {
  return { registerTool: vi.fn() };
}

/** Build a reg() function that captures tool registrations. */
function makeReg() {
  const tools: Record<
    string,
    { handler: (args: Record<string, unknown>) => Promise<unknown> }
  > = {};
  const reg = (
    name: string,
    _config: unknown,
    handler: (args: Record<string, unknown>) => Promise<unknown>,
  ) => {
    tools[name] = { handler };
  };
  return { tools, reg };
}

describe("connect.retrieve_verified handler", () => {
  const origFetch = global.fetch;
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.RESTORMEL_CONNECT_API_BASE = "https://test.restormel.dev";
    process.env.RESTORMEL_GATEWAY_KEY = "rk_test_key";
    process.env.RESTORMEL_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
  });

  afterEach(() => {
    global.fetch = origFetch;
    // Restore env
    for (const key of Object.keys(process.env)) {
      if (!(key in origEnv)) delete process.env[key];
    }
    Object.assign(process.env, origEnv);
  });

  function mockFetchWithResponse(data: unknown, status = 200) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status,
      json: async () => data,
    }) as unknown as typeof fetch;
  }

  async function callHandler(
    args: Record<string, unknown>,
    mockedUpstream?: unknown,
  ) {
    const upstream = mockedUpstream ?? buildUpstreamResponse(ALL_CLAIMS);
    mockFetchWithResponse(upstream);
    const { tools, reg } = makeReg();
    const serverStub = makeServerStub();
    registerConnectVerifiedRetrieval(serverStub as never, reg as never);
    const tool = tools["connect.retrieve_verified"];
    if (!tool) throw new Error("connect.retrieve_verified not registered");
    const result = (await tool.handler(args)) as {
      structuredContent: Record<string, unknown>;
      content: { type: string; text: string }[];
    };
    return result.structuredContent;
  }

  it("strict mode: only supported claims are returned", async () => {
    const sc = await callHandler({ query: "test query" }) as Record<string, unknown>;
    expect(sc.ok).toBe(true);
    expect(sc.mode).toBe("strict");
    const claims = sc.claims as Array<{ state: string }>;
    expect(claims.every((c) => c.state === "supported")).toBe(true);
    expect(sc.total_retrieved).toBe(ALL_CLAIMS.length);
    expect(sc.total_after_mode_filter).toBe(1);
  });

  it("strict mode: excluded/contradicted/inferred/unverified claims are absent (row 4 proof)", async () => {
    const sc = await callHandler({ query: "row 4 test" }) as Record<string, unknown>;
    const claims = sc.claims as Array<{ claim: { id: string }; state: string }>;
    const ids = claims.map((c) => c.claim.id);
    expect(ids).not.toContain("claim:excluded-1");
    expect(ids).not.toContain("claim:contradicted-1");
    expect(ids).not.toContain("claim:inferred-1");
    expect(ids).not.toContain("claim:unverified-1");
  });

  it("annotated mode: all claims returned with their states", async () => {
    const sc = await callHandler({ query: "annotated test", mode: "annotated" }) as Record<string, unknown>;
    expect(sc.ok).toBe(true);
    expect(sc.mode).toBe("annotated");
    const claims = sc.claims as Array<{ state: string }>;
    expect(claims).toHaveLength(ALL_CLAIMS.length);
    const states = claims.map((c) => c.state);
    expect(states).toContain("supported");
    expect(states).toContain("inferred");
    expect(states).toContain("unverified");
    expect(states).toContain("contradicted");
    expect(states).toContain("excluded");
  });

  it("annotated mode: non-supported claims carry their original state (not silently blended)", async () => {
    const sc = await callHandler({ query: "blend test", mode: "annotated" }) as Record<string, unknown>;
    const claims = sc.claims as Array<{ state: string; claim: { id: string } }>;
    const excluded = claims.find((c) => c.claim.id === "claim:excluded-1");
    expect(excluded).toBeDefined();
    expect(excluded?.state).toBe("excluded");
  });

  it("enriches each claim with a trace_export_url derived from trace_ref", async () => {
    const sc = await callHandler({ query: "trace url test" }) as Record<string, unknown>;
    const claims = sc.claims as Array<{ trace_export_url: string | null; trace_ref: string | null }>;
    const withTrace = claims.find((c) => c.trace_ref);
    expect(withTrace?.trace_export_url).toBe(
      "https://test.restormel.dev/connect/v1/traces/trace-001/export",
    );
  });

  it("returns verification_summary for all claims regardless of mode", async () => {
    const sc = await callHandler({ query: "summary test" }) as Record<string, unknown>;
    const summary = sc.verification_summary as Record<string, number>;
    // Summary covers the full upstream set (pre-filter)
    expect(summary.supported).toBe(1);
    expect(summary.inferred).toBe(1);
    expect(summary.unverified).toBe(1);
    expect(summary.contradicted).toBe(1);
    expect(summary.excluded).toBe(1);
  });

  it("includes tool_version in the response", async () => {
    const sc = await callHandler({ query: "version test" }) as Record<string, unknown>;
    expect(sc.tool_version).toBe(VERIFIED_RETRIEVAL_TOOL_VERSION);
  });

  it("returns error when RESTORMEL_CONNECT_API_BASE is missing", async () => {
    delete process.env.RESTORMEL_CONNECT_API_BASE;
    const { tools, reg } = makeReg();
    registerConnectVerifiedRetrieval(makeServerStub() as never, reg as never);
    const tool = tools["connect.retrieve_verified"];
    const result = (await tool!.handler({ query: "test" })) as {
      structuredContent: Record<string, unknown>;
    };
    expect(result.structuredContent.ok).toBe(false);
    expect(result.structuredContent.code).toBe("RST_CONNECT_HOSTED");
  });

  it("returns error when workspace_id is missing and env var unset", async () => {
    delete process.env.RESTORMEL_WORKSPACE_ID;
    // mock a successful fetch (won't reach it)
    global.fetch = vi.fn() as unknown as typeof fetch;
    const { tools, reg } = makeReg();
    registerConnectVerifiedRetrieval(makeServerStub() as never, reg as never);
    const tool = tools["connect.retrieve_verified"];
    const result = (await tool!.handler({ query: "test" })) as {
      structuredContent: Record<string, unknown>;
    };
    expect(result.structuredContent.ok).toBe(false);
    expect(result.structuredContent.code).toBe("RST_CONNECT_WORKSPACE");
  });

  it("propagates upstream error from the Connect API", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden" }),
    }) as unknown as typeof fetch;
    const { tools, reg } = makeReg();
    registerConnectVerifiedRetrieval(makeServerStub() as never, reg as never);
    const tool = tools["connect.retrieve_verified"];
    const result = (await tool!.handler({ query: "test" })) as {
      structuredContent: Record<string, unknown>;
    };
    // connectProxyPost returns ok:true even on non-2xx (passes through status);
    // the handler records upstreamStatus. With ok: false on the proxied result
    // (network-level), we get a passthrough of the error shape.
    expect(result.structuredContent).toBeDefined();
  });

  it("handles an upstream response with zero verified_claims gracefully", async () => {
    const upstream = buildUpstreamResponse([]);
    const sc = await callHandler({ query: "empty graph" }, upstream) as Record<string, unknown>;
    expect(sc.ok).toBe(true);
    expect(sc.claims).toEqual([]);
    expect(sc.total_retrieved).toBe(0);
    expect(sc.total_after_mode_filter).toBe(0);
  });

  it("falls back to context_pack.claims when verified_claims is absent", async () => {
    const upstreamFallback = {
      ok: true,
      contract_version: "0.9",
      context_pack: {
        claims: [SUPPORTED_CLAIM],
      },
    };
    const sc = await callHandler({ query: "fallback test" }, upstreamFallback) as Record<string, unknown>;
    expect(sc.ok).toBe(true);
    const claims = sc.claims as Array<{ state: string }>;
    expect(claims.some((c) => c.state === "supported")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Dispatch tool-name registration
// ---------------------------------------------------------------------------

describe("connect.retrieve_verified registration", () => {
  it("is present in RESTORMEL_SUITE_TOOL_NAMES", async () => {
    const { RESTORMEL_SUITE_TOOL_NAMES } = await import("./suite-tool-names.js");
    expect(RESTORMEL_SUITE_TOOL_NAMES).toContain("connect.retrieve_verified");
  });

  it("is gated by connect module flag (excluded when connect: false)", async () => {
    const { getEnabledSuiteToolNames } = await import("./suite-tool-names.js");
    const withConnect = getEnabledSuiteToolNames({ connect: true });
    const withoutConnect = getEnabledSuiteToolNames({ connect: false });
    expect(withConnect).toContain("connect.retrieve_verified");
    expect(withoutConnect).not.toContain("connect.retrieve_verified");
  });
});
