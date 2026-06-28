/**
 * Back-compat alias route (REC-ADR-008 rename). The host-managed Postgres graph-store
 * provisioner moved to `/graph-target/host-managed`; this path 308-redirects there.
 *
 * 308 (Permanent Redirect) preserves the POST method and body, so any in-flight client
 * still pointed at `/graph-target/neon` keeps working. The client `fetch` + the route are
 * one deploy unit, so the in-app caller already targets the new path; this alias only
 * covers external/cached callers.
 */
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/** Resolve the sibling `host-managed` path from the current request URL. */
function hostManagedHref(url: URL): string {
  return url.pathname.replace(/\/neon\/?$/, "/host-managed") + url.search;
}

export const POST: RequestHandler = ({ url }) => {
  throw redirect(308, hostManagedHref(url));
};
