import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProject, getProjectInWorkspace, listProviderBindingsByProject } from "$lib/server/db";

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
  const scope = await projectScope(locals, params.id);
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  if (!scope) return json({ error: "Not found" }, { status: 404 });

  const bindings = await listProviderBindingsByProject(scope.projectId);
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

  return json({
    data: {
      providers: [...byIntegrationId.values()],
    },
  });
};

