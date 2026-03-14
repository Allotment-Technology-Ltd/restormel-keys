/**
 * Resolve middleware: resolves provider/key per request, sets context.
 * Standard Web API Request/Response.
 */
import type { KeysInstance } from "../keys.js";
import type { Auth } from "./types.js";
import type { KeyConfig } from "../types.js";
import type { ResolveResult } from "../router.js";

export interface ResolveContext {
  userId: string | null;
  resolved: ResolveResult | null;
  error: string | null;
}

export interface ResolveMiddlewareOptions {
  auth: Auth;
  getByokKeys: (userId: string) => Promise<KeyConfig[]>;
}

/**
 * Create resolve middleware: runs resolution for the request and sets context.
 * Returns a Response (4xx) on auth/resolution failure, or null when resolved (caller should continue).
 */
export function createResolveMiddleware(
  keys: KeysInstance,
  options: ResolveMiddlewareOptions
): (req: Request, ctx: ResolveContext) => Promise<Response | null> {
  const { auth, getByokKeys } = options;
  const { router } = keys;

  return async (req: Request, ctx: ResolveContext): Promise<Response | null> => {
    const userId = await auth.getUserId(req);
    ctx.userId = userId ?? null;
    ctx.resolved = null;
    ctx.error = null;

    if (!userId) {
      ctx.error = "unauthorized";
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const providerId = url.searchParams.get("provider") ?? undefined;
    const modelId = url.searchParams.get("model") ?? undefined;

    try {
      const byokKeys = await getByokKeys(userId);
      const resolved = await router.resolveWithKeys(providerId, modelId, byokKeys);
      ctx.resolved = resolved;
      return null;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      ctx.error = message;
      return new Response(JSON.stringify({ error: message }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}
