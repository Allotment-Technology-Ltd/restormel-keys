import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { jwksFromPublicKey, signJwtRs256 } from "$lib/server/oidc";
import { getOrCreateDefaultWorkspace } from "$lib/server/db";
import { ensureZuploConsumer } from "$lib/server/zuplo-consumer";

const ISSUER = "https://restormel.dev/keys/auth";

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function exchangeGitHubCode(code: string): Promise<string> {
  const client_id = requiredEnv("PORTAL_GITHUB_CLIENT_ID");
  const client_secret = requiredEnv("PORTAL_GITHUB_CLIENT_SECRET");

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id, client_secret, code }),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || typeof json?.access_token !== "string") {
    throw new Error("GitHub token exchange failed");
  }
  return json.access_token as string;
}

async function fetchGitHubProfile(accessToken: string): Promise<{ id: string; name: string | null; email: string | null; avatar_url: string | null }> {
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" };
  const u = await fetch("https://api.github.com/user", { headers });
  const user = (await u.json().catch(() => ({}))) as any;
  const name = typeof user?.name === "string" ? user.name : null;
  const avatar_url = typeof user?.avatar_url === "string" ? user.avatar_url : null;

  // GitHub may not return email on /user depending on privacy; fetch verified primary email.
  let email: string | null = typeof user?.email === "string" ? user.email : null;
  if (!email) {
    const e = await fetch("https://api.github.com/user/emails", { headers });
    const emails = (await e.json().catch(() => [])) as any[];
    const primary = emails?.find?.((x) => x?.primary && x?.verified) ?? emails?.find?.((x) => x?.verified);
    email = typeof primary?.email === "string" ? primary.email : null;
  }

  const id = String(user?.id ?? "");
  return { id, name, email, avatar_url };
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get("code") ?? "";
  if (!code) throw redirect(302, "/");

  const ctxRaw = cookies.get("rm_oidc_ctx");
  cookies.delete("rm_oidc_ctx", { path: "/keys/auth" });
  const ctx = ctxRaw ? JSON.parse(Buffer.from(ctxRaw, "base64url").toString("utf8")) : null;
  const redirectUri = typeof ctx?.redirectUri === "string" ? ctx.redirectUri : "";
  const state = typeof ctx?.state === "string" ? ctx.state : url.searchParams.get("state") ?? "";

  const accessToken = await exchangeGitHubCode(code);
  const profile = await fetchGitHubProfile(accessToken);

  // Prefer matching an existing dashboard user by email. Fallback to GitHub user id.
  const userId = profile.email ? profile.email.toLowerCase() : `github:${profile.id}`;
  const ws = await getOrCreateDefaultWorkspace(userId);

  // Best-effort: ensure consumer exists so the portal can "Try it" after login.
  try {
    await ensureZuploConsumer({ workspaceId: ws.id, userEmail: profile.email });
  } catch {
    // no-op
  }

  const { kid } = jwksFromPublicKey();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60; // 1 hour

  const clientId = process.env.RESTORMEL_OIDC_CLIENT_ID ?? "";
  const idToken = signJwtRs256(
    {
      sub: ws.id,
      email: profile.email,
      name: profile.name ?? profile.email ?? "Developer",
      picture: profile.avatar_url,
      iat: now,
      exp,
    },
    { issuer: ISSUER, audience: clientId || "zudoku", kid }
  );

  // We use a signed JWT as the "code" to keep the flow stateless.
  const out = new URL(redirectUri || "https://restormel-keys-gateway-main-bc13eba.zuplo.site/oauth/callback");
  out.searchParams.set("code", idToken);
  if (state) out.searchParams.set("state", state);

  throw redirect(302, out.toString());
};

