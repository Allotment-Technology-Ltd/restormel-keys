type CorsOptions = {
  /**
   * Allowed request header names for preflight, e.g. ["authorization", "content-type"].
   * If omitted, mirrors `access-control-request-headers`.
   */
  allowHeaders?: string[];
  /**
   * Allowed methods, e.g. ["GET","POST","OPTIONS"].
   */
  allowMethods?: string[];
  /**
   * Optional additional exact origins (comma-separated) from env.
   */
  extraAllowedOriginsEnv?: string;
};

function parseExtraAllowedOrigins(envVarName: string | undefined): Set<string> {
  const name = envVarName?.trim();
  if (!name) return new Set();
  const raw = process.env[name]?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function isAllowedPortalOrigin(origin: string, extra: Set<string>): boolean {
  if (extra.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return host.endsWith(".zuplo.site") || host.endsWith(".zuplo.app");
  } catch {
    return false;
  }
}

export function portalCorsHeaders(
  request: Request,
  opts: CorsOptions = {}
): Record<string, string> | null {
  const origin = request.headers.get("origin") ?? "";
  if (!origin) return null;

  const extra = parseExtraAllowedOrigins(opts.extraAllowedOriginsEnv ?? "PORTAL_ALLOWED_ORIGINS");
  if (!isAllowedPortalOrigin(origin, extra)) return null;

  const reqHeaders = request.headers.get("access-control-request-headers") ?? "";
  const allowHeaders = (opts.allowHeaders?.length ? opts.allowHeaders.join(", ") : reqHeaders) || "authorization, content-type";
  const allowMethods = (opts.allowMethods?.length ? opts.allowMethods.join(", ") : "GET, POST, OPTIONS") as string;

  return {
    "access-control-allow-origin": origin,
    vary: "Origin",
    "access-control-allow-methods": allowMethods,
    "access-control-allow-headers": allowHeaders,
    // Bearer tokens only; no cookies needed cross-origin.
    "access-control-max-age": "600",
  };
}

export function withPortalCors(init: ResponseInit, cors: Record<string, string> | null): ResponseInit {
  if (!cors) return init;
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return { ...init, headers };
}

