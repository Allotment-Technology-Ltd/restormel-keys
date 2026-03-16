import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { base } from "$app/paths";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const baseWithSlash = base.endsWith("/") ? base : base + "/";

  // Fix malformed redirect from Neon Auth: params appended as path (e.g. /keys/dashboard/state=...&error=...)
  const pathname = url.pathname;
  if (pathname.startsWith(baseWithSlash) && pathname.length > baseWithSlash.length) {
    const afterBase = pathname.slice(baseWithSlash.length);
    if (afterBase.includes("=") && !afterBase.startsWith("?")) {
      throw redirect(302, `${url.origin}${baseWithSlash}?${afterBase}`);
    }
  }

  // If we land on the dashboard with a verifier in the query, send it to the redeem endpoint.
  const verifier = url.searchParams.get("neon_auth_session_verifier");
  if (verifier) {
    const redeemUrl = new URL(`${url.origin}${base}/api/auth/redeem`);
    redeemUrl.searchParams.set("neon_auth_session_verifier", verifier);
    throw redirect(302, redeemUrl.toString());
  }

  const authError = url.searchParams.get("error") ?? null;

  // Redirect unauthenticated users from protected routes to login (Overview shows welcome instead).
  const baseNorm = base.endsWith("/") ? base.slice(0, -1) : base;
  const protectedPaths = ["/projects", "/billing", "/settings"];
  const pathAfterBase = pathname.slice(pathname.indexOf(baseNorm) + baseNorm.length) || "/";
  const isProtected = protectedPaths.some((p) => pathAfterBase === p || pathAfterBase.startsWith(p + "/"));
  if (!locals.user && isProtected) {
    throw redirect(302, `${url.origin}${baseNorm}/login?redirect=${encodeURIComponent(pathname)}`);
  }

  return { user: locals.user, authError };
};
