/**
 * W2.4: load the generated MCP tool catalog server-side so the page always reflects
 * the registered tool set (connect.memory.write is now included — FUNC P2-7 fix).
 */
import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { CATALOG_ENTRIES, type CatalogEntry } from "@restormel/mcp";

export type { CatalogEntry };

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    throw redirect(302, `${DASHBOARD_BASE}/login?redirect=${encodeURIComponent(url.pathname)}`);
  }
  return {
    /** Generated catalog — never stale. Replaces the hand-maintained suiteTools array. */
    catalogEntries: CATALOG_ENTRIES as CatalogEntry[],
  };
};
