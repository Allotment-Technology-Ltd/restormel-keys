import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { base } from "$app/paths";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // Fix malformed redirect from Neon Auth: params appended as path (e.g. /keys/dashboard/state=...&error=...)
  const pathname = url.pathname;
  const baseWithSlash = base.endsWith("/") ? base : base + "/";
  if (pathname.startsWith(baseWithSlash) && pathname.length > baseWithSlash.length) {
    const afterBase = pathname.slice(baseWithSlash.length);
    if (afterBase.includes("=") && !afterBase.startsWith("?")) {
      throw redirect(302, `${url.origin}${baseWithSlash}?${afterBase}`);
    }
  }

  const authError = url.searchParams.get("error") ?? null;
  return { user: locals.user, authError };
};
