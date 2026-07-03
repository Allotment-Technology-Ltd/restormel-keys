/**
 * Tests for connect.memory.write (Stage 3.4 — agent memory write MCP tool).
 *
 * All tests run without live API keys: env stubs + a mocked global fetch (the
 * transport used by connectProxyPost), same conventions as
 * connect-verified-retrieval.test.ts. Covers:
 *
 *   - payload validation BEFORE any network call (contract schema, max batch),
 *   - env/workspace guard rails,
 *   - the happy path passing through results/summary/provenance transparently,
 *   - non-200 upstream mapping (429 rate limit with retry_after_seconds; auth),
 *   - suite-tool-names registration (Dispatch single source of truth).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MEMORY_WRITE_TOOL_VERSION,
  memoryWriteUpstreamError,
  registerConnectMemoryWrite,
} from "./connect-memory-write.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Note: zod v4 .uuid() enforces RFC 4122 version bits — all-zero UUIDs do not parse.
const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";

const OBS = {
  text: "Paris is the capital of France.",
  evidence: {
    quote: "Paris is the capital of France",
    source_ref: "https://example.com/geo",
    context: "The handbook notes that Paris is the capital of France and lies on the Seine.",
  },
};

function buildUpstreamResponse(): Record<string, unknown> {
  return {
    contract_version: "1.0",
    request_id: "req-mem-001",
    source_id: "src-1",
    provenance: { kind: "agent_observation", key_id: "key-abc", auth_type: "gateway_key" },
    results: [
      {
        index: 0,
        unit_id: "u-1",
        claim_key: "a".repeat(64),
        text: OBS.text,
        verification_state: "supported",
        evidence_binding: "bound",
        outcome: "accepted",
        repaired: false,
        reasons: ["entailment_entailed"],
      },
    ],
    summary: { supported: 1, inferred: 0, unverified: 0, excluded: 0, embedded: 1 },
  };
}

/** A minimal McpServer stub (the tool registers through reg(), not the server). */
function makeServerStub() {
  return { registerTool: vi.fn() };
}

function makeReg() {
  const tools: Record<string, { handler: (args: Record<string, unknown>) => Promise<unknown> }> = {};
  const reg = (
    name: string,
    _config: unknown,
    handler: (args: Record<string, unknown>) => Promise<unknown>,
  ) => {
    tools[name] = { handler };
  };
  return { tools, reg };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("memoryWriteUpstreamError", () => {
  it("maps 429 to RST_CONNECT_RATE_LIMITED and carries retry_after_seconds", () => {
    const out = memoryWriteUpstreamError(429, {
      error: "rate_limited",
      message: "Memory write rate limit reached for this key — retry in 42s.",
      retry_after_seconds: 42,
    });
    expect(out.ok).toBe(false);
    expect(out.code).toBe("RST_CONNECT_RATE_LIMITED");
    expect(out.retry_after_seconds).toBe(42);
    expect(out.upstreamStatus).toBe(429);
  });

  it("maps 401/403 to RST_CONNECT_AUTH", () => {
    expect(memoryWriteUpstreamError(401, { error: "unauthorized" }).code).toBe("RST_CONNECT_AUTH");
    expect(memoryWriteUpstreamError(403, { error: "forbidden" }).code).toBe("RST_CONNECT_AUTH");
  });

  it("maps everything else to RST_CONNECT_MEMORY_WRITE with the upstream message", () => {
    const out = memoryWriteUpstreamError(503, {
      error: "connect_llm_not_configured",
      message: "No validation route configured.",
    });
    expect(out.code).toBe("RST_CONNECT_MEMORY_WRITE");
    expect(out.message).toBe("No validation route configured.");
    expect(out.upstreamStatus).toBe(503);
  });
});

describe("MEMORY_WRITE_TOOL_VERSION", () => {
  it("is a semver string", () => {
    expect(MEMORY_WRITE_TOOL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ---------------------------------------------------------------------------
// Handler integration tests (mock fetch)
// ---------------------------------------------------------------------------

describe("connect.memory.write handler", () => {
  const origFetch = global.fetch;
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.RESTORMEL_CONNECT_API_BASE = "https://test.restormel.dev";
    process.env.RESTORMEL_GATEWAY_KEY = "rk_test_key";
    process.env.RESTORMEL_WORKSPACE_ID = WORKSPACE_ID;
  });

  afterEach(() => {
    global.fetch = origFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in origEnv)) delete process.env[key];
    }
    Object.assign(process.env, origEnv);
  });

  function mockFetchWithResponse(data: unknown, status = 200) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
      json: async () => data,
    }) as unknown as typeof fetch;
    return global.fetch as unknown as ReturnType<typeof vi.fn>;
  }

  function getHandler() {
    const { tools, reg } = makeReg();
    registerConnectMemoryWrite(makeServerStub() as never, reg as never);
    const tool = tools["connect.memory.write"];
    if (!tool) throw new Error("connect.memory.write not registered");
    return tool.handler;
  }

  async function callHandler(args: Record<string, unknown>) {
    const result = (await getHandler()(args)) as {
      structuredContent: Record<string, unknown>;
      content: { type: string; text: string }[];
    };
    return result.structuredContent;
  }

  it("happy path: passes results, summary, and provenance through transparently", async () => {
    mockFetchWithResponse(buildUpstreamResponse());
    const sc = await callHandler({ observations: [OBS] });
    expect(sc.ok).toBe(true);
    expect(sc.tool_version).toBe(MEMORY_WRITE_TOOL_VERSION);
    expect(sc.request_id).toBe("req-mem-001");
    expect(sc.source_id).toBe("src-1");
    expect(sc.provenance).toEqual({
      kind: "agent_observation",
      key_id: "key-abc",
      auth_type: "gateway_key",
    });
    const results = sc.results as Array<Record<string, unknown>>;
    expect(results).toHaveLength(1);
    expect(results[0].outcome).toBe("accepted");
    expect(results[0].verification_state).toBe("supported");
    expect(sc.summary).toEqual({ supported: 1, inferred: 0, unverified: 0, excluded: 0, embedded: 1 });
  });

  it("sends the gateway key as a Bearer token to POST /connect/v1/memory", async () => {
    const fetchMock = mockFetchWithResponse(buildUpstreamResponse());
    await callHandler({ observations: [OBS] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://test.restormel.dev/connect/v1/memory");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer rk_test_key");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.workspace_id).toBe(WORKSPACE_ID);
    expect(Array.isArray(body.observations)).toBe(true);
  });

  it("rejects malformed payloads locally — no network call", async () => {
    const fetchMock = mockFetchWithResponse(buildUpstreamResponse());
    const sc = await callHandler({ observations: [{ text: "" }] });
    expect(sc.ok).toBe(false);
    expect(sc.code).toBe("RST_CONNECT_MEMORY_SHAPE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects more than the max batch size locally — memory writes are never bulk ingest", async () => {
    const fetchMock = mockFetchWithResponse(buildUpstreamResponse());
    const sc = await callHandler({ observations: Array.from({ length: 11 }, () => OBS) });
    expect(sc.ok).toBe(false);
    expect(sc.code).toBe("RST_CONNECT_MEMORY_SHAPE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires RESTORMEL_CONNECT_API_BASE + RESTORMEL_GATEWAY_KEY", async () => {
    delete process.env.RESTORMEL_CONNECT_API_BASE;
    delete process.env.RESTORMEL_GATEWAY_KEY;
    const sc = await callHandler({ observations: [OBS] });
    expect(sc.ok).toBe(false);
    expect(sc.code).toBe("RST_CONNECT_HOSTED");
  });

  it("requires a workspace id (arg or env)", async () => {
    delete process.env.RESTORMEL_WORKSPACE_ID;
    const sc = await callHandler({ observations: [OBS] });
    expect(sc.ok).toBe(false);
    expect(sc.code).toBe("RST_CONNECT_WORKSPACE");
  });

  it("surfaces an upstream 429 as a rate-limit error with retry_after_seconds", async () => {
    mockFetchWithResponse(
      { error: "rate_limited", message: "retry in 17s", retry_after_seconds: 17 },
      429,
    );
    const sc = await callHandler({ observations: [OBS] });
    expect(sc.ok).toBe(false);
    expect(sc.code).toBe("RST_CONNECT_RATE_LIMITED");
    expect(sc.retry_after_seconds).toBe(17);
  });

  it("surfaces an upstream fail-closed 503 (judge not configured) transparently", async () => {
    mockFetchWithResponse(
      {
        error: "connect_llm_not_configured",
        message: "No validation route or provider credentials are configured.",
      },
      503,
    );
    const sc = await callHandler({ observations: [OBS] });
    expect(sc.ok).toBe(false);
    expect(sc.code).toBe("RST_CONNECT_MEMORY_WRITE");
    expect(sc.upstreamStatus).toBe(503);
  });

  it("is part of the Dispatch suite tool name list and gated by the connect flag", async () => {
    const { RESTORMEL_SUITE_TOOL_NAMES, getEnabledSuiteToolNames } = await import(
      "./suite-tool-names.js"
    );
    expect(RESTORMEL_SUITE_TOOL_NAMES).toContain("connect.memory.write");
    expect(getEnabledSuiteToolNames({ connect: true })).toContain("connect.memory.write");
    expect(getEnabledSuiteToolNames({ connect: false })).not.toContain("connect.memory.write");
  });
});
