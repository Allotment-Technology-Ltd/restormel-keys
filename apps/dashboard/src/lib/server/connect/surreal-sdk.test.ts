import { afterEach, describe, expect, it } from "vitest";
import { isWebSocketSurrealEndpoint, surrealRpcUrl, surrealSdkQuery } from "./surreal-sdk";

describe("isWebSocketSurrealEndpoint", () => {
  it("detects ws/wss and rejects http/https", () => {
    expect(isWebSocketSurrealEndpoint("wss://host:8000")).toBe(true);
    expect(isWebSocketSurrealEndpoint("ws://localhost:8000")).toBe(true);
    expect(isWebSocketSurrealEndpoint("  WSS://Host ")).toBe(true);
    expect(isWebSocketSurrealEndpoint("https://host")).toBe(false);
    expect(isWebSocketSurrealEndpoint("http://localhost")).toBe(false);
  });
});

describe("surrealRpcUrl", () => {
  it("appends /rpc and trims trailing slashes", () => {
    expect(surrealRpcUrl("wss://host:8000")).toBe("wss://host:8000/rpc");
    expect(surrealRpcUrl("wss://host:8000/")).toBe("wss://host:8000/rpc");
    expect(surrealRpcUrl("wss://host:8000/rpc")).toBe("wss://host:8000/rpc");
  });
});

describe("surrealSdkQuery guards (no network)", () => {
  const origNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
  });

  it("rejects an endpoint that fails outbound validation before connecting", async () => {
    process.env.NODE_ENV = "production";
    // ws:// (insecure) in production is rejected by validateOutboundSurrealEndpoint.
    const r = await surrealSdkQuery({
      endpoint: "ws://example.com:8000",
      namespace: "ns",
      database: "db",
      sql: "RETURN true;",
    });
    expect(r.ok).toBe(false);
  });

  it("fails with a clear message when no global WebSocket is available", async () => {
    const orig = (globalThis as { WebSocket?: unknown }).WebSocket;
    (globalThis as { WebSocket?: unknown }).WebSocket = undefined;
    try {
      const r = await surrealSdkQuery({
        endpoint: "wss://example.com:8000",
        namespace: "ns",
        database: "db",
        sql: "RETURN true;",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/WebSocket/i);
    } finally {
      (globalThis as { WebSocket?: unknown }).WebSocket = orig;
    }
  });
});
