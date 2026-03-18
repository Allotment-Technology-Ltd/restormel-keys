import type { PageServerLoad } from "./$types";
import {
  listProjects,
  listApiKeys,
  listProviderIntegrations,
  getOrCreateDefaultWorkspace,
  aggregateRequestLogsToUsage,
} from "$lib/server/db";
import { getWorkspaceEntitlements } from "$lib/server/entitlements";

function monthStartMs(now: number): number {
  const d = new Date(now);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return {
      projects: [],
      projectsError: null,
      onboarding: null,
      entitlements: null,
      usage: null,
    };
  }
  try {
    const [workspace, projects, ent] = await Promise.all([
      getOrCreateDefaultWorkspace(locals.user.uid),
      listProjects(locals.user.uid),
      getWorkspaceEntitlements(locals),
    ]);
    let hasKeys = false;
    for (const p of projects) {
      const keys = await listApiKeys(p.id, locals.user!.uid);
      if (keys.length > 0) {
        hasKeys = true;
        break;
      }
    }
    const integrations = await listProviderIntegrations(workspace.id);
    const hasIntegrations = integrations.length > 0;
    let usedThisMonth: number | null = null;
    if (ent) {
      const now = Date.now();
      const since = monthStartMs(now);
      const until = now;
      const usage = await aggregateRequestLogsToUsage(ent.workspaceId, { since, until });
      usedThisMonth = usage.reduce((acc, r) => acc + (r.requestCount ?? 0), 0);
    }
    return {
      projects,
      projectsError: null,
      onboarding: {
        hasProjects: projects.length > 0,
        hasKeys,
        hasIntegrations,
      },
      entitlements: ent,
      usage: ent
        ? {
            usedThisMonth,
            monthlyLimit: ent.monthlyRequestLimit,
            projectLimit: ent.projectLimit,
            providersConnected: integrations.length,
          }
        : null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[overview] load failed:", msg.slice(0, 120));
    return {
      projects: [],
      projectsError: "Unable to load projects",
      onboarding: null,
      entitlements: null,
      usage: null,
    };
  }
};
