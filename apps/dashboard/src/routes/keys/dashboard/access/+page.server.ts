/**
 * W3.7 + K1: Gateway keys page server load.
 *
 * Before this PR:
 *   - Called listApiKeys per project in a loop (N+1 — K-P2-3).
 *   - Dropped createdAt and never selected lastUsedAt (K-P1-1).
 *
 * After this PR:
 *   - Single workspace-scoped query via listApiKeysByWorkspace (one JOIN, no loop).
 *   - Returns label, createdAt, lastUsedAt for each key.
 *   - LocalStorage label migration: count of un-labelled keys informs the migration offer UI.
 *
 * Auth: uses sessionUser helper per W4.6a convention (#288).
 */
import type { PageServerLoad } from "./$types";
import {
  listApiKeysByWorkspace,
  listProjects,
  getOrCreateDefaultWorkspace,
  type ApiKeyWithProject,
} from "$lib/server/db";
import { sessionUser } from "$lib/server/session-user";

export type { ApiKeyWithProject };

export const load: PageServerLoad = async ({ locals, url }) => {
  const su = sessionUser(locals);
  if (!su) {
    return {
      signedIn: false,
      projects: [] as { id: string; name: string }[],
      keys: [] as ApiKeyWithProject[],
      workspaceId: null as string | null,
      error: null as string | null,
      keysBaseUrl: url.origin,
    };
  }
  try {
    const workspace = await getOrCreateDefaultWorkspace(su.uid);
    // Single workspace-scoped query — fixes the N+1 (was: listApiKeys per project in a loop).
    const [projects, keys] = await Promise.all([
      listProjects(su.uid),
      listApiKeysByWorkspace(workspace.id),
    ]);
    return {
      signedIn: true,
      projects,
      keys,
      workspaceId: workspace.id,
      error: null,
      keysBaseUrl: url.origin,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[access] load failed:", msg.slice(0, 120));
    return {
      signedIn: true,
      projects: [] as { id: string; name: string }[],
      keys: [] as ApiKeyWithProject[],
      workspaceId: null,
      error: "Unable to load access data",
      keysBaseUrl: url.origin,
    };
  }
};
