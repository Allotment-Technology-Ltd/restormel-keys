import { searchDocs, type DocIndexEntry } from "@restormel/mcp";

/**
 * Doc search for Restormel Support — delegates to MCP offline index (same as \`docs.search\`).
 */
export function searchRestormelDocumentation(
  query: string,
  section?: string,
  limit = 8,
): DocIndexEntry[] {
  return searchDocs(query, section, limit);
}

export type { DocIndexEntry };
