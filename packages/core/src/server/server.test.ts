/**
 * Server middleware tests: masked keys on GET, validate+store on POST, resolution, mock proxy.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createKeys } from "../keys.js";
import { createMiddleware } from "./middleware.js";
import { createResolveMiddleware } from "./resolve.js";
import { createProxy } from "./proxy.js";
import { createMemoryStorage } from "../storage/memory.js";
import { openaiProvider, anthropicProvider } from "../providers/index.js";
import type { KeysConfig } from "../types.js";

const providers = [openaiProvider, anthropicProvider];

function authWithUser(userId: string) {
  return {
    getUserId: async () => userId,
  };
}

describe("middleware – masked keys on GET", () => {
  const storage = createMemoryStorage();
  const config: KeysConfig = { keys: [], routing: { defaultProvider: "openai" } };
  const keys = createKeys(config, { providers });
  const handler = createMiddleware(keys, {
    auth: authWithUser("u1"),
    storage,
    providers,
  });

  beforeEach(async () => {
    await storage.set("u1", "k1", { id: "k1", provider: "openai", label: "My key" });
  });

  it("GET /keys returns list with masked keys (no raw key)", async () => {
    const res = await handler(new Request("http://localhost/keys"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { keys: unknown[] };
    expect(data.keys).toHaveLength(1);
    const key = data.keys[0] as Record<string, unknown>;
    expect(key.id).toBe("k1");
    expect(key.provider).toBe("openai");
    expect(key.label).toBe("My key");
    expect(key).not.toHaveProperty("apiKey");
    expect(JSON.stringify(key)).not.toMatch(/sk-/);
  });

  it("GET /keys/:id returns single masked key", async () => {
    const res = await handler(new Request("http://localhost/keys/k1"));
    expect(res.status).toBe(200);
    const key = (await res.json()) as Record<string, unknown>;
    expect(key.id).toBe("k1");
    expect(key).not.toHaveProperty("apiKey");
  });

  it("returns 401 when not authenticated", async () => {
    const noAuth = createMiddleware(keys, {
      auth: { getUserId: async () => null },
      storage,
      providers,
    });
    const res = await noAuth(new Request("http://localhost/keys"));
    expect(res.status).toBe(401);
  });
});

describe("middleware – validate and store on POST", () => {
  const storage = createMemoryStorage();
  const config: KeysConfig = { keys: [], routing: {} };
  const keys = createKeys(config, { providers });
  const handler = createMiddleware(keys, {
    auth: authWithUser("u1"),
    storage,
    providers,
  });

  it("POST /keys validates key and stores metadata", async () => {
    const validateSpy = vi.spyOn(openaiProvider, "validateKey").mockResolvedValue({ valid: true });

    const res = await handler(
      new Request("http://localhost/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", apiKey: "sk-test", label: "Test" }),
      })
    );

    expect(res.status).toBe(201);
    validateSpy.mockRestore();

    const list = await storage.list("u1");
    expect(list.length).toBe(1);
    expect(list[0].provider).toBe("openai");
    expect(list[0].label).toBe("Test");
  });

  it("POST returns 400 when validation fails", async () => {
    vi.spyOn(openaiProvider, "validateKey").mockResolvedValue({
      valid: false,
      errors: ["Invalid key"],
    });

    const res = await handler(
      new Request("http://localhost/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", apiKey: "sk-bad" }),
      })
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("invalid_key");
  });
});

describe("middleware – DELETE", () => {
  const storage = createMemoryStorage();
  const keys = createKeys({} as KeysConfig, { providers });
  const handler = createMiddleware(keys, {
    auth: authWithUser("u1"),
    storage,
    providers,
  });

  it("DELETE /keys/:id removes key", async () => {
    await storage.set("u1", "to-delete", { id: "to-delete", provider: "openai" });
    const res = await handler(new Request("http://localhost/keys/to-delete", { method: "DELETE" }));
    expect(res.status).toBe(204);
    expect(await storage.get("u1", "to-delete")).toBeNull();
  });
});

describe("resolve middleware – correct resolution", () => {
  const storage = createMemoryStorage();
  const config: KeysConfig = {
    keys: [],
    routing: { defaultProvider: "openai", rules: ["openai", "anthropic"] },
  };
  const keys = createKeys(config, { providers });
  const resolveMiddleware = createResolveMiddleware(keys, {
    auth: authWithUser("u1"),
    getByokKeys: (userId) => storage.list(userId).then((list) => list.map((k) => ({ provider: k.provider!, id: k.id }))),
  });

  it("sets ctx.resolved when user has BYOK key", async () => {
    await storage.set("u1", "k1", { id: "k1", provider: "openai" });
    const ctx = { userId: null as string | null, resolved: null as import("./resolve.js").ResolveContext["resolved"], error: null as string | null };
    const res = await resolveMiddleware(new Request("http://localhost/?provider=openai"), ctx);
    expect(res).toBeNull();
    expect(ctx.userId).toBe("u1");
    expect(ctx.resolved).not.toBeNull();
    expect(ctx.resolved!.provider).toBe("openai");
    expect(ctx.resolved!.source).toBe("byok");
  });

  it("returns 503 when no key available", async () => {
    const emptyStorage = createMemoryStorage();
    const keysNoKeys = createKeys(
      { routing: { defaultProvider: "openai" } } as KeysConfig,
      { providers }
    );
    const resolveNoKeys = createResolveMiddleware(keysNoKeys, {
      auth: authWithUser("u1"),
      getByokKeys: () => emptyStorage.list("u1").then((list) => list.map((k) => ({ provider: k.provider!, id: k.id }))),
    });
    const ctx = { userId: null as string | null, resolved: null, error: null as string | null };
    const res = await resolveNoKeys(new Request("http://localhost/"), ctx);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
  });
});

describe("proxy – mock proxy", () => {
  const config: KeysConfig = { routing: { defaultProvider: "openai" } };
  const keys = createKeys(config, { providers });
  const proxy = createProxy(keys, {
    auth: authWithUser("u1"),
    getKeyValue: async () => "sk-mock",
  });

  it("returns 503 when ctx not resolved", async () => {
    const ctx = { userId: null, resolved: null, error: "not_resolved" };
    const res = await proxy(new Request("http://localhost/"), ctx);
    expect(res.status).toBe(503);
  });

  it("returns 503 when getKeyValue returns null", async () => {
    const noKeyProxy = createProxy(keys, {
      auth: authWithUser("u1"),
      getKeyValue: async () => null,
    });
    const ctx = { userId: "u1", resolved: { provider: "openai", source: "byok" as const }, error: null };
    const res = await noKeyProxy(new Request("http://localhost/"), ctx);
    expect(res.status).toBe(503);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("key_unavailable");
  });

  it("forwards request with mocked fetch", async () => {
    const mockBody = JSON.stringify({ id: "chatcmpl-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(mockBody, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const ctx = { userId: "u1", resolved: { provider: "openai", source: "byok" as const }, error: null };
    const res = await proxy(new Request("http://localhost/proxy/v1/chat/completions"), ctx);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(mockBody);
    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(fetchCall[0]).toContain("api.openai.com");
    const init = fetchCall[1];
    const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Bearer sk-mock");

    vi.unstubAllGlobals();
  });
});
