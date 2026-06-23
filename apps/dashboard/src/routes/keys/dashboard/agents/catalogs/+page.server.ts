/**
 * R5: Agents / Catalogs tab.
 * Absorbs /dev-tools (CLI, MCP catalog, Dispatch).
 * W2.4's generated MCP catalog (CATALOG_ENTRIES from @restormel/mcp) loads here
 * so the tab reflects the live tool set.
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
    catalogEntries: CATALOG_ENTRIES as CatalogEntry[],
  };
};
