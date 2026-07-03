/**
 * Key management middleware: GET (list, masked), POST (validate + store), DELETE.
 * Standard Web API Request/Response.
 */
import type { KeysInstance } from "../keys.js";
import type { Auth } from "./types.js";
import type { KeyStorage } from "../storage/types.js";
import type { ProviderDefinition } from "../providers/types.js";

const DEFAULT_PATH = "/keys";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Return a key record for API response: id, provider, label only — never raw key material. */
function toMaskedKey(stored: { id: string; provider?: string; label?: string }) {
  return { id: stored.id, provider: stored.provider, label: stored.label };
}

export interface KeyManagementOptions {
  auth: Auth;
  storage: KeyStorage;
  providers: ProviderDefinition[];
  /** Base path for key routes (default /keys). */
  path?: string;
}

/**
 * Create key management handlers: GET list (masked), POST validate+store, DELETE by id.
 */
export function createMiddleware(
  _keys: KeysInstance,
  options: KeyManagementOptions
): (req: Request) => Promise<Response> {
  const { auth, storage, providers, path = DEFAULT_PATH } = options;
  const pathPrefix = path.replace(/\/$/, "");
  const pathMatchList = (req: Request) => {
    const p = new URL(req.url).pathname.replace(/\/$/, "");
    return p === pathPrefix;
  };
  const parseId = (req: Request): string | null => {
    const p = new URL(req.url).pathname.replace(/\/$/, "");
    const after = pathPrefix + "/";
    if (!p.startsWith(after)) return null;
    const rest = p.slice(after.length);
    const segment = rest.split("/")[0];
    return segment || null;
  };
  const pathMatchWithId = (req: Request) => parseId(req) !== null;

  return async (req: Request): Promise<Response> => {
    const userId = await auth.getUserId(req);
    if (!userId) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const method = req.method.toUpperCase();

    if (method === "GET" && pathMatchList(req)) {
      const list = await storage.list(userId);
      return jsonResponse({ keys: list.map(toMaskedKey) });
    }

    if (method === "GET" && pathMatchWithId(req)) {
      const id = parseId(req);
      if (!id) return jsonResponse({ error: "bad_request" }, 400);
      const key = await storage.get(userId, id);
      if (!key) return jsonResponse({ error: "not_found" }, 404);
      return jsonResponse(toMaskedKey(key));
    }

    if (method === "POST" && pathMatchList(req)) {
      let body: { provider?: string; apiKey?: string; label?: string; id?: string };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return jsonResponse({ error: "invalid_json" }, 400);
      }
      const { provider, apiKey, label, id: keyId } = body;
      if (!provider || apiKey === undefined) {
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
      await storage.set(userId, id, stored);
      return jsonResponse(toMaskedKey(stored), 201);
    }

    if (method === "DELETE" && pathMatchWithId(req)) {
      const id = parseId(req);
      if (!id) return jsonResponse({ error: "bad_request" }, 400);
      const existing = await storage.get(userId, id);
      if (!existing) return jsonResponse({ error: "not_found" }, 404);
      await storage.delete(userId, id);
      return new Response(null, { status: 204 });
    }

    return jsonResponse({ error: "not_found" }, 404);
  };
}
