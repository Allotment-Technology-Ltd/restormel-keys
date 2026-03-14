/**
 * Proxy: forwards requests with resolved key, supports streaming.
 * Standard Web API Request/Response; no framework imports.
 */
import type { KeysInstance } from "../keys.js";
import type { Auth } from "./types.js";
import type { ResolveResult } from "../router.js";
import type { ResolveContext } from "./resolve.js";

export interface ProxyOptions {
  auth: Auth;
  getKeyValue: (userId: string, resolved: ResolveResult) => Promise<string | null>;
}

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
};

function getBaseUrl(provider: string): string {
  return PROVIDER_BASE_URLS[provider] ?? `https://api.${provider}.com`;
}

/**
 * Create proxy handler: forwards request to provider with resolved API key, streams response.
 */
export function createProxy(
  keys: KeysInstance,
  options: ProxyOptions
): (req: Request, ctx: ResolveContext) => Promise<Response> {
  const { getKeyValue } = options;

  return async (req: Request, ctx: ResolveContext): Promise<Response> => {
    if (ctx.error || !ctx.userId || !ctx.resolved) {
      return new Response(JSON.stringify({ error: ctx.error ?? "not_resolved" }), {
        status: ctx.error === "unauthorized" ? 401 : 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { resolved, userId } = ctx;
    const keyValue = await getKeyValue(userId, resolved);
    if (!keyValue) {
      return new Response(JSON.stringify({ error: "key_unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const baseUrl = getBaseUrl(resolved.provider);
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/proxy\/?/, "") || "v1/chat/completions";
    let targetUrl = `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}${url.search}`;

    const headers = new Headers(req.headers);
    if (resolved.provider === "openai") {
      headers.set("Authorization", `Bearer ${keyValue}`);
    } else if (resolved.provider === "anthropic") {
      headers.set("x-api-key", keyValue);
    } else if (resolved.provider === "google") {
      const u = new URL(targetUrl);
      u.searchParams.set("key", keyValue);
      targetUrl = u.toString();
    }
    headers.delete("host");

    const init: RequestInit = {
      method: req.method,
      headers,
    };
    if (req.method !== "GET" && req.body != null) {
      (init as RequestInit & { duplex?: string }).duplex = "half";
      init.body = req.body;
    }

    const upstream = await fetch(targetUrl, init);
    const resHeaders = new Headers(upstream.headers);
    resHeaders.delete("transfer-encoding");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: resHeaders,
    });
  };
}
