import type { Cookies } from "@sveltejs/kit";
import { safeDashboardRedirectPath } from "$lib/dashboard-entry";
import { isUseCaseId } from "$lib/content/use-cases";

export const AUTH_RETURN_COOKIE = "rm_auth_return";

const COOKIE_PATH = "/keys/dashboard";

type AuthReturnPayload = {
  redirect?: string;
  template?: string;
};

function encodePayload(payload: AuthReturnPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(raw: string | undefined): AuthReturnPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as AuthReturnPayload;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setAuthReturnCookie(
  cookies: Cookies,
  args: { redirect: string | null; template: string | null },
): void {
  const redirect = args.redirect?.trim() ? safeDashboardRedirectPath(args.redirect) : undefined;
  const template =
    args.template?.trim() && isUseCaseId(args.template.trim()) ? args.template.trim() : undefined;
  if (!redirect && !template) return;

  const payload: AuthReturnPayload = {};
  if (redirect) payload.redirect = redirect;
  if (template) payload.template = template;

  cookies.set(AUTH_RETURN_COOKIE, encodePayload(payload), {
    path: COOKIE_PATH,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
  });
}

export function consumeAuthReturnCookie(cookies: Cookies): AuthReturnPayload | null {
  const raw = cookies.get(AUTH_RETURN_COOKIE);
  cookies.delete(AUTH_RETURN_COOKIE, { path: COOKIE_PATH });
  const payload = decodePayload(raw);
  if (!payload) return null;

  const redirect = payload.redirect ? safeDashboardRedirectPath(payload.redirect) : undefined;
  const template =
    payload.template && isUseCaseId(payload.template) ? payload.template : undefined;

  if (!redirect && !template) return null;
  return { redirect, template };
}

export function buildPostAuthLocation(
  origin: string,
  payload: AuthReturnPayload | null,
  fallbackPath: string,
): string {
  const base = payload?.redirect
    ? safeDashboardRedirectPath(payload.redirect)
    : safeDashboardRedirectPath(fallbackPath);
  const url = new URL(base, origin);
  if (payload?.template) {
    url.searchParams.set("template", payload.template);
  }
  return `${url.pathname}${url.search}`;
}
