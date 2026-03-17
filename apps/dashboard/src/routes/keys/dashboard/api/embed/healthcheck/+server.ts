import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { hasProAccess } from "$lib/server/feature-gates";
import { listProviderIntegrations, listPolicies, listModels, listProjectsByWorkspace } from "$lib/server/db";

/**
 * Embeddable health report for BYOK apps (Pro).
 *
 * Auth: session or management_key (workspace scoped). Does not accept gateway_key.
 * Safety: never returns raw secrets; only references + masked identifiers already stored.
 */
export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  if (!hasProAccess(locals, "embedding")) {
    return json({ error: "Pro feature required" }, { status: 403 });
  }

  const [projects, integrations, policies, models] = await Promise.all([
    listProjectsByWorkspace(ctx.workspaceId),
    listProviderIntegrations(ctx.workspaceId),
    listPolicies(ctx.workspaceId),
    listModels({ limit: 200 }),
  ]);

  // This payload is intended to be safe to show to end-users in a BYOK app:
  // - no raw provider keys
  // - no credential refs that look like secrets
  return json({
    data: {
      workspaceId: ctx.workspaceId,
      generatedAt: Date.now(),
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
      integrations: integrations.map((i) => ({
        id: i.id,
        providerType: i.providerType,
        displayName: i.displayName,
        status: i.status,
        verificationStatus: i.verificationStatus,
        lastVerifiedAt: i.lastVerifiedAt,
        region: i.region,
      })),
      policies: {
        total: policies.length,
      },
      models: {
        total: models.length,
        latestSourceVerifiedAt: models.reduce<number | null>((acc, m) => {
          if (m.sourceLastVerifiedAt == null) return acc;
          return acc == null ? m.sourceLastVerifiedAt : Math.max(acc, m.sourceLastVerifiedAt);
        }, null),
      },
    },
  });
};

