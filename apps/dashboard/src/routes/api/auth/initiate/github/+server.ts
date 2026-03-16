import { json, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { base } from "$app/paths";

const NEON_AUTH_BASE_URL = (process.env.NEON_AUTH_BASE_URL ?? "").replace(/\/$/, "");

export const GET: RequestHandler = async ({ url }) => {
  if (!NEON_AUTH_BASE_URL) {
    return json({ error: "Neon Auth not configured" }, { status: 503 });
  }

  const callbackURL = `${url.origin}${base}/api/auth/redeem`;

  let res: Response;
  try {
    res = await fetch(`${NEON_AUTH_BASE_URL}/sign-in/social`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: url.origin,
      },
      body: JSON.stringify({
        provider: "github",
        callbackURL,
        newUserCallbackURL: callbackURL,
        errorCallbackURL: callbackURL,
      }),
      redirect: "manual",
    });
  } catch (e) {
    console.error("[auth] Neon Auth sign-in/social network error", {
      error: e instanceof Error ? e.message : String(e),
      endpoint: `${NEON_AUTH_BASE_URL}/sign-in/social`,
      callbackURL,
    });
    return json(
      {
        error: "Failed to reach Neon Auth for GitHub sign-in",
        upstreamStatus: null,
        upstreamMessage: e instanceof Error ? e.message : String(e),
      },
      { status: 502 }
    );
  }

  // Prefer redirect Location header if present.
  const location = res.headers.get("Location");
  if (location && res.status >= 300 && res.status < 400) {
    throw redirect(302, location);
  }

  // Fallback: try to read JSON { data: { url } } shape.
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  // Neon may respond either with { data: { url } } or with { url, redirect: true }.
  let maybeUrl: string | null = null;
  if (data && typeof data === "object") {
    if ("data" in data && (data as any).data?.url) {
      maybeUrl = (data as any).data.url;
    } else if ("url" in data && typeof (data as any).url === "string") {
      maybeUrl = (data as any).url;
    }
  }

  if (typeof maybeUrl === "string") {
    throw redirect(302, maybeUrl);
  }

  // If we reach here, Neon returned a non-redirect response. Surface its body and status directly
  // so we can see the real error instead of a generic 502.
  let fallbackText = "";
  try {
    fallbackText = typeof data === "string" ? data : JSON.stringify(data);
  } catch {
    // ignore
  }

  return new Response(fallbackText || "Neon Auth did not return a redirect URL", {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "text/plain",
    },
  });
};

