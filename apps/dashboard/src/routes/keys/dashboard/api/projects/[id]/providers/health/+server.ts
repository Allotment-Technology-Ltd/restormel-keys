import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getProject,
  getProjectById,
  getProjectInWorkspace,
  listProviderBindingsByProject,
  listProviderIntegrations,
} from "$lib/server/db";

type ProviderHealth = "ok" | "warn" | "fail";

function healthFromVerification(verificationStatus: string | null | undefined): ProviderHealth {
  if (verificationStatus === "verified") return "ok";
  if (verificationStatus === "pending") return "warn";
  return "fail";
}

async function projectScope(
  locals: App.Locals,
  projectId: string
): Promise<{ projectId: string; userId: string } | null> {
  if (!locals.user) return null;
  if (locals.user.authType === "gateway_key") {
    if (locals.user.projectIdForKey !== projectId) return null;
    return { projectId, userId: locals.user.uid };
  }
  if (locals.user.authType === "management_key" && locals.user.workspaceId) {
    const project = await getProjectInWorkspace(projectId, locals.user.workspaceId);
    return project ? { projectId, userId: project.userId } : null;
  }
  const project = await getProject(projectId, locals.user.uid);
  return project ? { projectId, userId: locals.user.uid } : null;
}

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const scope = await projectScope(locals, params.id);
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    if (!scope) return json({ error: "Not found" }, { status: 404 });

    const bindings = await listProviderBindingsByProject(scope.projectId);
    const project =
      locals.user?.authType === "gateway_key"
        ? await getProjectById(scope.projectId)
        : await getProject(scope.projectId, scope.userId);
    const workspaceIntegrations = project?.workspaceId
      ? await listProviderIntegrations(project.workspaceId)
      : [];

    const byIntegrationId = new Map<
      string,
      {
        providerIntegrationId: string;
        providerType: string;
        displayName: string | null;
        verificationStatus: string | null;
        health: ProviderHealth;
      }
    >();

    for (const b of bindings) {
      const integration = b.integration;
      if (!integration) continue;
      const key = integration.id;
      if (byIntegrationId.has(key)) continue;
      byIntegrationId.set(key, {
        providerIntegrationId: integration.id,
        providerType: integration.providerType,
        displayName: integration.displayName,
        verificationStatus: integration.verificationStatus ?? null,
        health: healthFromVerification(integration.verificationStatus),
      });
    }

    // Fallback: if project has no explicit bindings yet, surface workspace integrations
    // so clients can still inspect provider verification state.
    if (byIntegrationId.size === 0) {
      for (const integration of workspaceIntegrations) {
        byIntegrationId.set(integration.id, {
          providerIntegrationId: integration.id,
          providerType: integration.providerType,
          displayName: integration.displayName,
          verificationStatus: integration.verificationStatus ?? null,
          health: healthFromVerification(integration.verificationStatus),
        });
      }
    }

    return json({
      data: {
        providers: [...byIntegrationId.values()],
      },
    });
  } catch (e) {
    console.error("[providers.health] internal error:", e);
    return json({ error: "internal_error", detail: "providers_health_failed" }, { status: 500 });
  }
};

