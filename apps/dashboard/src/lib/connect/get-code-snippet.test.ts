import { describe, expect, it } from "vitest";
import {
  buildGetCodeSnippet,
  buildRetrieveBody,
  GATEWAY_KEY_ENV,
  GRAPH_OP_PATH,
  DEFAULT_CONNECT_API_BASE,
  type GetCodeSnippetInput,
} from "./get-code-snippet";

const BASE_INPUT: GetCodeSnippetInput = {
  workspaceId: "550e8400-e29b-41d4-a716-446655440000",
  question: "What is the Gettier challenge to justified true belief?",
};

describe("buildRetrieveBody", () => {
  it("produces a retrieve_context body with the verbatim (trimmed) query", () => {
    const body = buildRetrieveBody({ ...BASE_INPUT, question: "  Why the trolley problem?  " });
    expect(body).toEqual({
      workspace_id: BASE_INPUT.workspaceId,
      operation: "retrieve_context",
      query: "Why the trolley problem?",
    });
  });

  it("includes project_id only when supplied", () => {
    expect(buildRetrieveBody(BASE_INPUT).project_id).toBeUndefined();
    const scoped = buildRetrieveBody({ ...BASE_INPUT, projectId: "proj-1" });
    expect(scoped.project_id).toBe("proj-1");
  });

  it("clamps max_claims into the contract bounds (1..500) and omits non-positive", () => {
    expect(buildRetrieveBody({ ...BASE_INPUT, maxClaims: 24 }).max_claims).toBe(24);
    expect(buildRetrieveBody({ ...BASE_INPUT, maxClaims: 9999 }).max_claims).toBe(500);
    expect(buildRetrieveBody({ ...BASE_INPUT, maxClaims: 24.9 }).max_claims).toBe(24);
    expect(buildRetrieveBody({ ...BASE_INPUT, maxClaims: 0 }).max_claims).toBeUndefined();
    expect(buildRetrieveBody({ ...BASE_INPUT, maxClaims: -5 }).max_claims).toBeUndefined();
  });
});

describe("buildGetCodeSnippet", () => {
  it("returns curl + Node/TS tabs hitting POST /connect/v1/graph", () => {
    const { tabs } = buildGetCodeSnippet(BASE_INPUT);
    expect(tabs.map((t) => t.id)).toEqual(["curl", "node"]);
    for (const tab of tabs) {
      expect(tab.code).toContain(GRAPH_OP_PATH);
      expect(tab.code).toContain(DEFAULT_CONNECT_API_BASE);
    }
  });

  it("reproduces a valid retrieve_context request body", () => {
    const { requestBody } = buildGetCodeSnippet({ ...BASE_INPUT, maxClaims: 24 });
    expect(requestBody.operation).toBe("retrieve_context");
    expect(requestBody.workspace_id).toBe(BASE_INPUT.workspaceId);
    expect(requestBody.query).toBe(BASE_INPUT.question);
    expect(requestBody.max_claims).toBe(24);
  });

  it("SECURITY: never embeds a raw key — only the env var reference, never a literal", () => {
    const { tabs } = buildGetCodeSnippet({
      ...BASE_INPUT,
      keyPrefixHint: "rk_abcdefgh…",
    });
    const curl = tabs.find((t) => t.id === "curl")!;
    const node = tabs.find((t) => t.id === "node")!;
    // The key is read from the environment, not written into the snippet.
    expect(curl.code).toContain(`Bearer $${GATEWAY_KEY_ENV}`);
    expect(node.code).toContain(`process.env.${GATEWAY_KEY_ENV}`);
    // The prefix appears ONLY in a hint comment (non-secret), never as a Bearer literal.
    expect(curl.code).toContain("rk_abcdefgh…");
    expect(curl.code).not.toMatch(/Bearer\s+rk_/);
    expect(node.code).not.toMatch(/Bearer\s+rk_/);
  });

  it("SECURITY: omits the key hint entirely when no prefix is known", () => {
    const { tabs } = buildGetCodeSnippet(BASE_INPUT);
    for (const tab of tabs) {
      expect(tab.code).not.toContain("rk_");
      // Still references the env var so the developer knows where the key goes.
      expect(tab.code).toContain(GATEWAY_KEY_ENV);
    }
  });

  it("SECURITY: a hostile query cannot break out of the snippet string (JSON-encoded)", () => {
    const hostile = `'; rm -rf / #\n"injected": true, "x": "`;
    const { tabs, requestBody } = buildGetCodeSnippet({ ...BASE_INPUT, question: hostile });
    // The body still round-trips as the literal query value.
    expect(requestBody.query).toBe(hostile);
    const curl = tabs.find((t) => t.id === "curl")!;
    // The curl body is a single-quoted JSON blob; the query lives inside JSON-escaped
    // quotes, so the embedded single-quote/newline is encoded, not literal shell.
    const jsonStart = curl.code.indexOf("-d '") + 4;
    const jsonEnd = curl.code.lastIndexOf("'");
    const jsonText = curl.code.slice(jsonStart, jsonEnd);
    const parsed = JSON.parse(jsonText) as { query: string };
    expect(parsed.query).toBe(hostile);
  });

  it("Node tab body parses as valid JSON (object-literal is JSON-encoded)", () => {
    const { tabs } = buildGetCodeSnippet({ ...BASE_INPUT, projectId: "p1", maxClaims: 12 });
    const node = tabs.find((t) => t.id === "node")!;
    const start = node.code.indexOf("JSON.stringify(") + "JSON.stringify(".length;
    const end = node.code.indexOf("),", start);
    const literal = node.code.slice(start, end);
    const parsed = JSON.parse(literal) as { workspace_id: string; project_id: string };
    expect(parsed.workspace_id).toBe(BASE_INPUT.workspaceId);
    expect(parsed.project_id).toBe("p1");
  });

  it("normalises a trailing slash on the API base", () => {
    const { tabs } = buildGetCodeSnippet({ ...BASE_INPUT, apiBase: "https://example.test/" });
    for (const tab of tabs) {
      expect(tab.code).toContain(`https://example.test${GRAPH_OP_PATH}`);
      expect(tab.code).not.toContain(`example.test/${GRAPH_OP_PATH}`);
    }
  });
});
