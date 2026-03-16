import { json, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { base } from "$app/paths";

const NEON_AUTH_BASE_URL = (process.env.NEON_AUTH_BASE_URL ?? "").replace(/\/$/, "");

export const GET: RequestHandler = async ({ url }) => {
  if (!NEON_AUTH_BASE_URL) {
    return json(
      { error: "Neon Auth not configured" },
      { status: 503 }
    );
  }

  const callbackURL = `${url.origin}${base}/api/auth/redeem`;

  const res = await fetch(`${NEON_AUTH_BASE_URL}/sign-in/social`, {
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

  const maybeUrl =
    data && typeof data === "object" && "data" in data
      ? (data as any).data?.url
      : null;

  if (typeof maybeUrl === "string") {
    throw redirect(302, maybeUrl);
  }

  return json(
    { error: "Failed to start GitHub sign-in" },
    { status: 502 }
  );
};

