import { redirect, error, isRedirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/auth";
import { jwksFromPublicKey, signJwtRs256 } from "$lib/server/oidc";
import { getOrCreateDefaultWorkspace } from "$lib/server/db";
import { ensureZuploConsumer } from "$lib/server/zuplo-consumer";
import { isAllowedPortalOidcRedirectUri } from "$lib/server/portal-oidc-redirect";

const ISSUER = "https://restormel.dev/keys/auth";

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export const GET: RequestHandler = async ({ url, cookies, request }) => {
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const scope = url.searchParams.get("scope") ?? "openid profile email";

  if (!redirectUri || !isAllowedPortalOidcRedirectUri(redirectUri)) {
    throw error(400, "Invalid or missing redirect_uri");
  }

  // SSO: already signed in via Neon Auth (dashboard) — skip second GitHub OAuth for the portal.
  const { data: session } = await getSession(request, url.host);
  if (session?.user?.id) {
    try {
      const ws = await getOrCreateDefaultWorkspace(session.user.id);
      try {
        await ensureZuploConsumer({
          workspaceId: ws.id,
          userEmail: session.user.email ?? null,
        });
      } catch {
        // no-op
      }
      const { kid } = jwksFromPublicKey();
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 60 * 60;
      const clientId = process.env.RESTORMEL_OIDC_CLIENT_ID ?? "";
      const idToken = signJwtRs256(
        {
          sub: ws.id,
          email: session.user.email ?? null,
          name: session.user.name ?? session.user.email ?? "Developer",
          picture: null,
          iat: now,
          exp,
        },
        { issuer: ISSUER, audience: clientId || "zudoku", kid }
      );
      const out = new URL(redirectUri);
      out.searchParams.set("code", idToken);
      if (state) out.searchParams.set("state", state);
      throw redirect(302, out.toString());
    } catch (e) {
      if (isRedirect(e)) throw e;
      // Missing OIDC keys or other errors — fall through to GitHub portal login.
    }
  }

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
    maxAge: 10 * 60,
  });

  const githubClientId = requiredEnv("PORTAL_GITHUB_CLIENT_ID");
  const githubAuthorize = new URL("https://github.com/login/oauth/authorize");
  githubAuthorize.searchParams.set("client_id", githubClientId);
  githubAuthorize.searchParams.set("redirect_uri", "https://restormel.dev/keys/auth/callback");
  githubAuthorize.searchParams.set("scope", "read:user user:email");
  githubAuthorize.searchParams.set("state", state || globalThis.crypto.randomUUID());

  throw redirect(302, githubAuthorize.toString());
};
