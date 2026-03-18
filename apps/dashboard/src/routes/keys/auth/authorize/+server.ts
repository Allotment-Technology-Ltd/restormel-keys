import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const scope = url.searchParams.get("scope") ?? "openid profile email";

  // Persist original client redirect + state for callback.
  const ctx = {
    redirectUri,
    state,
    scope,
    createdAt: Date.now(),
  };
  cookies.set("rm_oidc_ctx", Buffer.from(JSON.stringify(ctx), "utf8").toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/keys/auth",
    maxAge: 10 * 60, // 10 minutes
  });

  const githubClientId = requiredEnv("PORTAL_GITHUB_CLIENT_ID");
  const githubAuthorize = new URL("https://github.com/login/oauth/authorize");
  githubAuthorize.searchParams.set("client_id", githubClientId);
  githubAuthorize.searchParams.set("redirect_uri", "https://restormel.dev/keys/auth/callback");
  githubAuthorize.searchParams.set("scope", "read:user user:email");
  githubAuthorize.searchParams.set("state", state || globalThis.crypto.randomUUID());

  throw redirect(302, githubAuthorize.toString());
};

