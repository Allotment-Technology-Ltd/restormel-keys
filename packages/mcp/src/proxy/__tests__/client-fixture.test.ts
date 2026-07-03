import { describe, expect, it } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  verifyEnvelope,
  makeStubValidator,
  type Mode1Result,
} from "@restormel/connect-core";
import {
  connectUpstreamTransport,
  callTool,
  callMode1Tool,
  parseMode1ToolResult,
  firstText,
  UpstreamCallError,
} from "../client.js";
import {
  createMode1UpstreamServer,
  MODE1_TOOL_NAME,
  FIXTURE_ANSWER_AUTHOR,
  FIXTURE_EXPECTATIONS,
} from "../fixtures/mode1-upstream.js";

/**
 * Integration: the proxy Client ↔ the fixture McpServer over the SDK's in-memory linked-pair
 * transport (deterministic CI — NO subprocess spawning). The round-trip returns a text
 * CallToolResult; verifyEnvelope over it yields the expected supported / review statuses.
 */
async function linkProxyToFixture() {
  const server = createMode1UpstreamServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const conn = await connectUpstreamTransport(clientTransport);
  return {
    conn,
    close: async () => {
      await conn.close();
      await server.close().catch(() => {});
    },
  };
}

describe("proxy client ↔ fixture upstream (in-memory transport)", () => {
  it("round-trips a text CallToolResult from the Mode-1 tool", async () => {
    const { conn, close } = await linkProxyToFixture();
    try {
      const raw = await callTool({
        client: conn.client,
        name: MODE1_TOOL_NAME,
        args: { query: "Who built the first Eddystone lighthouse?" },
      });
      const text = firstText(raw);
      expect(text).not.toBeNull();
      const parsed = JSON.parse(text!) as Mode1Result;
      expect(typeof parsed.answer).toBe("string");
      expect(Array.isArray(parsed.sources)).toBe(true);
      expect(parsed.sources[0]!.id).toBe("lighthouse");
    } finally {
      await close();
    }
  });

  it("callMode1Tool parses into a typed Mode1Result", async () => {
    const { conn, close } = await linkProxyToFixture();
    try {
      const result = await callMode1Tool({
        client: conn.client,
        name: MODE1_TOOL_NAME,
        args: { query: "Tell me about the waggle dance of the honey bee." },
      });
      expect(result.claims).toContain(FIXTURE_EXPECTATIONS.honeybee.grounded);
      expect(result.claims).toContain(FIXTURE_EXPECTATIONS.honeybee.planted);
      expect(result.sources[0]!.id).toBe("honeybee");
    } finally {
      await close();
    }
  });

  it("lists the single Mode-1 tool", async () => {
    const { conn, close } = await linkProxyToFixture();
    try {
      const tools = await conn.client.listTools();
      const names = tools.tools.map((t) => t.name);
      expect(names).toContain(MODE1_TOOL_NAME);
    } finally {
      await close();
    }
  });
});

describe("verifyEnvelope over the live fixture round-trip (stub validator)", () => {
  it("grounded claim → supported; planted unsupported → review (not passed)", async () => {
    const { conn, close } = await linkProxyToFixture();
    try {
      const result = await callMode1Tool({
        client: conn.client,
        name: MODE1_TOOL_NAME,
        args: { query: "Who built the first Eddystone lighthouse?" },
      });

      const { grounded, planted } = FIXTURE_EXPECTATIONS.lighthouse;
      // Stub validator: retrieve a verbatim span for the grounded claim and entail it; the
      // planted claim has no entailing span and is judged not_entailed.
      const validator = makeStubValidator({
        family: "restormel-validator", // independent of the fixture author family.
        fixtureVerdicts: {
          [grounded]: { verdict: "entailed", confidence: 0.95 },
          [planted]: { verdict: "not_entailed", confidence: 0.9 },
        },
        fixtureQuotes: {
          [grounded]: ["The first lighthouse built on the Eddystone Rocks was completed in 1698 by Henry Winstanley"],
          // No quote for the planted claim → unbound → never supported.
        },
      });

      const env = await verifyEnvelope({
        result,
        validator,
        author: FIXTURE_ANSWER_AUTHOR,
      });

      const byClaim = new Map(env.claims.map((c) => [c.claim, c]));
      const groundedClaim = byClaim.get(grounded)!;
      expect(groundedClaim.status).toBe("supported");
      expect(groundedClaim.binding.status).toBe("bound");
      expect(groundedClaim.source_ref.source_hash).toMatch(/^[0-9a-f]{64}$/);

      const plantedClaim = byClaim.get(planted)!;
      expect(plantedClaim.status).not.toBe("supported");
      expect(["unverified", "abstain"]).toContain(plantedClaim.status);
    } finally {
      await close();
    }
  });

  it("validator family == fixture author → fail-closed: nothing passes", async () => {
    const { conn, close } = await linkProxyToFixture();
    try {
      const result = await callMode1Tool({
        client: conn.client,
        name: MODE1_TOOL_NAME,
        args: { query: "Eddystone lighthouse" },
      });
      const { grounded } = FIXTURE_EXPECTATIONS.lighthouse;
      // SAME family as the fixture author → D-c independence fails → fail-closed validator.
      const validator = makeStubValidator({
        family: FIXTURE_ANSWER_AUTHOR.family,
        fixtureVerdicts: { "*": { verdict: "entailed", confidence: 0.99 } },
        fixtureQuotes: {
          [grounded]: ["The first lighthouse built on the Eddystone Rocks was completed in 1698 by Henry Winstanley"],
        },
      });
      const env = await verifyEnvelope({ result, validator, author: FIXTURE_ANSWER_AUTHOR });
      for (const c of env.claims) expect(c.status).toBe("abstain");
      expect(env.meta.validator_model).toContain("fail-closed");
    } finally {
      await close();
    }
  });
});

describe("R-nontext: non-text upstream results route to review, never a pass", () => {
  it("parseMode1ToolResult throws on a result with no text content", () => {
    expect(() => parseMode1ToolResult({ content: [] })).toThrow(UpstreamCallError);
    expect(() => parseMode1ToolResult({ content: [{ type: "image", text: undefined }] })).toThrow(
      UpstreamCallError,
    );
  });
});
