/**
 * OAuth2 helpers for Google Drive and Microsoft Graph (SharePoint/OneDrive).
 * Env-gated: connectors are only available when the OAuth app credentials are
 * configured. Tokens are exchanged/refreshed here; the BFF handles redirects and
 * the connections service stores the (encrypted) refresh token.
 */

export type OAuthTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

// ── Google ───────────────────────────────────────────────────────────────────

export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export function googleOauthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim());
}

export function googleAuthorizeUrl(args: { redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    redirect_uri: args.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_DRIVE_SCOPE,
    state: args.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function postForm(url: string, form: Record<string, string>): Promise<OAuthTokens> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OAuth token request failed (HTTP ${res.status}). ${detail.slice(0, 160)}`.trim());
  }
  return (await res.json()) as OAuthTokens;
}

export function googleExchangeCode(args: { code: string; redirectUri: string }): Promise<OAuthTokens> {
  return postForm("https://oauth2.googleapis.com/token", {
    code: args.code,
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
    redirect_uri: args.redirectUri,
    grant_type: "authorization_code",
  });
}

export function googleRefresh(refreshToken: string): Promise<OAuthTokens> {
  return postForm("https://oauth2.googleapis.com/token", {
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
  });
}

// ── Microsoft (Graph) ──────────────────────────────────────────────────────────

export const MS_SCOPE = "offline_access Files.Read.All Sites.Read.All";

export function microsoftOauthConfigured(): boolean {
  return Boolean(process.env.MS_OAUTH_CLIENT_ID?.trim() && process.env.MS_OAUTH_CLIENT_SECRET?.trim());
}

function msTenant(): string {
  return process.env.MS_OAUTH_TENANT?.trim() || "common";
}

export function microsoftAuthorizeUrl(args: { redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: process.env.MS_OAUTH_CLIENT_ID ?? "",
    redirect_uri: args.redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: MS_SCOPE,
    state: args.state,
  });
  return `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/authorize?${params.toString()}`;
}

export function microsoftExchangeCode(args: { code: string; redirectUri: string }): Promise<OAuthTokens> {
  return postForm(`https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/token`, {
    code: args.code,
    client_id: process.env.MS_OAUTH_CLIENT_ID ?? "",
    client_secret: process.env.MS_OAUTH_CLIENT_SECRET ?? "",
    redirect_uri: args.redirectUri,
    grant_type: "authorization_code",
    scope: MS_SCOPE,
  });
}

export function microsoftRefresh(refreshToken: string): Promise<OAuthTokens> {
  return postForm(`https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/token`, {
    refresh_token: refreshToken,
    client_id: process.env.MS_OAUTH_CLIENT_ID ?? "",
    client_secret: process.env.MS_OAUTH_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    scope: MS_SCOPE,
  });
}
