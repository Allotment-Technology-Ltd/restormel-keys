import { c as createKeys } from "./anthropic.js";
const DEFAULT_PATH = "/keys";
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
function toMaskedKey(stored) {
  return { id: stored.id, provider: stored.provider, label: stored.label };
}
function createMiddleware(_keys, options) {
  const { auth, storage: storage2, providers, path = DEFAULT_PATH } = options;
  const pathPrefix = path.replace(/\/$/, "");
  const pathMatchList = (req) => {
    const p = new URL(req.url).pathname.replace(/\/$/, "");
    return p === pathPrefix;
  };
  const parseId = (req) => {
    const p = new URL(req.url).pathname.replace(/\/$/, "");
    const after = pathPrefix + "/";
    if (!p.startsWith(after))
      return null;
    const rest = p.slice(after.length);
    const segment = rest.split("/")[0];
    return segment || null;
  };
  const pathMatchWithId = (req) => parseId(req) !== null;
  return async (req) => {
    const userId = await auth.getUserId(req);
    if (!userId) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }
    const method = req.method.toUpperCase();
    if (method === "GET" && pathMatchList(req)) {
      const list = await storage2.list(userId);
      return jsonResponse({ keys: list.map(toMaskedKey) });
    }
    if (method === "GET" && pathMatchWithId(req)) {
      const id = parseId(req);
      if (!id)
        return jsonResponse({ error: "bad_request" }, 400);
      const key = await storage2.get(userId, id);
      if (!key)
        return jsonResponse({ error: "not_found" }, 404);
      return jsonResponse(toMaskedKey(key));
    }
    if (method === "POST" && pathMatchList(req)) {
      let body;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "invalid_json" }, 400);
      }
      const { provider, apiKey, label, id: keyId } = body;
      if (!provider || apiKey === void 0) {
        return jsonResponse({ error: "provider and apiKey required" }, 400);
      }
      const providerDef = providers.find((p) => p.id === provider);
      if (!providerDef) {
        return jsonResponse({ error: "unknown_provider" }, 400);
      }
      const validation = await providerDef.validateKey(apiKey);
      if (!validation.valid) {
        return jsonResponse({ error: "invalid_key", errors: validation.errors }, 400);
      }
      const id = keyId ?? `key-${provider}-${Date.now()}`;
      const stored = { id, provider, label };
      await storage2.set(userId, id, stored);
      return jsonResponse(toMaskedKey(stored), 201);
    }
    if (method === "DELETE" && pathMatchWithId(req)) {
      const id = parseId(req);
      if (!id)
        return jsonResponse({ error: "bad_request" }, 400);
      const existing = await storage2.get(userId, id);
      if (!existing)
        return jsonResponse({ error: "not_found" }, 404);
      await storage2.delete(userId, id);
      return new Response(null, { status: 204 });
    }
    return jsonResponse({ error: "not_found" }, 404);
  };
}
function createMemoryStorage() {
  const keys = /* @__PURE__ */ new Map();
  const usage = /* @__PURE__ */ new Map();
  function userKeys(userId) {
    let m = keys.get(userId);
    if (!m) {
      m = /* @__PURE__ */ new Map();
      keys.set(userId, m);
    }
    return m;
  }
  function userUsage(userId) {
    let m = usage.get(userId);
    if (!m) {
      m = /* @__PURE__ */ new Map();
      usage.set(userId, m);
    }
    return m;
  }
  return {
    async get(userId, keyId) {
      return userKeys(userId).get(keyId) ?? null;
    },
    async list(userId) {
      return Array.from(userKeys(userId).values());
    },
    async set(userId, keyId, value) {
      userKeys(userId).set(keyId, { ...value, id: keyId });
    },
    async delete(userId, keyId) {
      userKeys(userId).delete(keyId);
      userUsage(userId).delete(keyId);
    },
    async getUsage(userId, keyId) {
      const u = userUsage(userId);
      if (keyId !== void 0) {
        const one = u.get(keyId) ?? null;
        return one ?? [];
      }
      return Array.from(u.values());
    },
    async trackUsage(userId, keyId, usageEntry) {
      userUsage(userId).set(keyId, { ...usageEntry, keyId });
    }
  };
}
const storage = createMemoryStorage();
const demoAuth = {
  async getUserId(req) {
    return req.headers.get("x-user-id") ?? "demo-user";
  }
};
function createKeysHandler(providers) {
  const keys = createKeys(
    { keys: [], routing: { defaultProvider: "openai" } },
    { providers }
  );
  return createMiddleware(keys, {
    auth: demoAuth,
    storage,
    providers,
    path: "/api/keys"
  });
}
export {
  createKeysHandler as c
};
