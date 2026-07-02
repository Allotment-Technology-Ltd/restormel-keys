import { describe, it, expect } from "vitest";
import {
  CONNECTION_METHODS,
  ACCESS_BADGE,
  connectionEndpoint,
  deriveMockMethod,
  deriveMockAccess,
  connectionName,
  connectionFromKey,
  getMethod,
  resolveConnectSurface,
  resolveConnectProject,
  showReadWriteSuggestion,
  type ConnectionView,
} from "./connection-model";

describe("connection-model — MVP methods (REC-ADR-018 addendum §1: MCP + REST only)", () => {
  it("exposes exactly two method cards, MCP first, REST second", () => {
    expect(CONNECTION_METHODS.map((m) => m.id)).toEqual(["mcp", "rest"]);
  });

  it("cards carry the copy pack §4.2 user-goal strings verbatim", () => {
    const [mcp, rest] = CONNECTION_METHODS;
    expect(mcp.title).toBe("Connect an agent");
    expect(mcp.description).toBe(
      "For Claude, ChatGPT, or any agent that supports MCP (the connector most AI agents use).",
    );
    expect(mcp.chip).toBe("MCP");
    expect(mcp.namePrefill).toBe("agent");
    expect(rest.title).toBe("Connect your own code");
    expect(rest.description).toBe(
      "For your app or backend — a simple web API your code can call.",
    );
    expect(rest.chip).toBe("REST API");
    expect(rest.namePrefill).toBe("backend");
  });

  it("every method carries an icon kind (icons, never letters)", () => {
    for (const m of CONNECTION_METHODS) {
      expect(m.icon).toBe(m.id);
    }
  });

  it("getMethod throws on unknown ids (no silent fallthrough)", () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => getMethod("nope")).toThrow();
  });

  it("access badges are the copy pack §4.4 row-anatomy labels", () => {
    expect(ACCESS_BADGE.read).toBe("READ");
    expect(ACCESS_BADGE.read_write).toBe("READ + WRITE");
  });
});

describe("resolveConnectSurface — S0/S1/S2 (REC-ADR-018 addendum, 2026-07-01)", () => {
  it("S0 whenever no graph exists — even with stray keys (same gate as nav/Home)", () => {
    expect(resolveConnectSurface({ hasGraph: false, connectionCount: 0 })).toBe("s0");
    expect(resolveConnectSurface({ hasGraph: false, connectionCount: 3 })).toBe("s0");
  });

  it("S1 when built with zero connections; S2 from the first connection", () => {
    expect(resolveConnectSurface({ hasGraph: true, connectionCount: 0 })).toBe("s1");
    expect(resolveConnectSurface({ hasGraph: true, connectionCount: 1 })).toBe("s2");
    expect(resolveConnectSurface({ hasGraph: true, connectionCount: 7 })).toBe("s2");
  });
});

describe("resolveConnectProject — silent resolution (addendum §3)", () => {
  const p = (id: string) => ({ id, name: id });

  it("prefers the default project; never ambiguous when a default exists", () => {
    expect(resolveConnectProject({ defaultProjectId: "b", projects: [p("a"), p("b")] })).toEqual({
      projectId: "b",
      ambiguous: false,
    });
  });

  it("falls back to the first project; a single project is never ambiguous", () => {
    expect(resolveConnectProject({ defaultProjectId: null, projects: [p("a")] })).toEqual({
      projectId: "a",
      ambiguous: false,
    });
  });

  it("is ambiguous ONLY with 2+ projects and no default (the chip's reveal predicate)", () => {
    expect(resolveConnectProject({ defaultProjectId: null, projects: [p("a"), p("b")] })).toEqual({
      projectId: "a",
      ambiguous: true,
    });
  });

  it("yields null with no projects at all", () => {
    expect(resolveConnectProject({ defaultProjectId: null, projects: [] })).toEqual({
      projectId: null,
      ambiguous: false,
    });
  });
});

describe("showReadWriteSuggestion — the §4.4 nudge predicate", () => {
  const conn = (over: Partial<ConnectionView>): ConnectionView => ({
    keyId: "k1",
    keyPrefix: "rk_live_aa",
    name: "agent",
    method: "mcp",
    access: "read",
    projectId: "proj_1",
    isMockScope: false,
    ...over,
  });

  it("shows ONLY when exactly one connection exists and it is read-only", () => {
    expect(showReadWriteSuggestion([conn({})])).toBe(true);
  });

  it("hidden for zero, multiple, or read+write connections", () => {
    expect(showReadWriteSuggestion([])).toBe(false);
    expect(showReadWriteSuggestion([conn({}), conn({ keyId: "k2" })])).toBe(false);
    expect(showReadWriteSuggestion([conn({ access: "read_write" })])).toBe(false);
  });
});

describe("connectionEndpoint — real endpoints, no decorative fragments", () => {
  it("MCP points at the Connect API base (what the MCP config carries)", () => {
    expect(connectionEndpoint({ connectApiBase: "https://c.dev/", method: "mcp" })).toBe(
      "https://c.dev",
    );
  });

  it("REST points at the retrieve surface", () => {
    expect(connectionEndpoint({ connectApiBase: "https://c.dev", method: "rest" })).toBe(
      "https://c.dev/connect/v1/retrieve",
    );
  });
});

describe("legacy-key fallbacks (cosmetic only — enforced keys carry a real scope)", () => {
  it("derives REST from rest-ish labels, MCP otherwise", () => {
    expect(deriveMockMethod("prod backend REST")).toBe("rest");
    expect(deriveMockMethod("my http caller")).toBe("rest");
    expect(deriveMockMethod("agent")).toBe("mcp");
    expect(deriveMockMethod(null)).toBe("mcp");
    // Old widget/SDK/GraphQL guesses collapse to the MVP pair.
    expect(deriveMockMethod("site chat widget")).toBe("mcp");
  });

  it("derives read+write only from writeish labels; read is the safe default", () => {
    expect(deriveMockAccess("agent read+write")).toBe("read_write");
    expect(deriveMockAccess("agent")).toBe("read");
    expect(deriveMockAccess(null)).toBe("read");
  });

  it("connectionName falls back to the method prefill", () => {
    expect(connectionName("  my agent  ", "mcp")).toBe("my agent");
    expect(connectionName("", "rest")).toBe("backend");
    expect(connectionName(null, "mcp")).toBe("agent");
  });
});

describe("connectionFromKey — enforced scope vs legacy fallback", () => {
  it("reflects a persisted (enforced) scope and clears isMockScope", () => {
    const v = connectionFromKey({
      id: "k1",
      keyPrefix: "rk_live_aa",
      label: "backend",
      projectId: "proj_1",
      keyType: "rest",
      access: "read_write",
    });
    expect(v.method).toBe("rest");
    expect(v.access).toBe("read_write");
    expect(v.isMockScope).toBe(false);
  });

  it("falls back to label-derived guesses for legacy flat keys (isMockScope)", () => {
    const v = connectionFromKey({
      id: "k2",
      keyPrefix: "rk_live_bb",
      label: "prod backend REST",
      projectId: "proj_1",
    });
    expect(v.method).toBe("rest");
    expect(v.access).toBe("read");
    expect(v.isMockScope).toBe(true);
  });
});
