import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getProject,
  getProjectById,
  getProjectInWorkspace,
  listProviderBindingsByProject,
  listProviderIntegrations,
  listRoutes,
  listRouteSteps,
} from "$lib/server/db";

type ProviderHealth = "ok" | "warn" | "fail";
type ProviderConfidence = "high" | "medium" | "low";

function healthFromVerification(verificationStatus: string | null | undefined): ProviderHealth {
  if (verificationStatus === "verified") return "ok";
  if (verificationStatus === "pending") return "warn";
  return "fail";
}

function confidenceFromHealth(health: ProviderHealth): ProviderConfidence {
  if (health === "ok") return "high";
  if (health === "warn") return "medium";
  return "low";
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
        confidence: ProviderConfidence;
        lastVerifiedAt: number | null;
        degradedReason: string | null;
        evidence: string[];
        boundRoutes: number;
        boundSteps: number;
        availableModels: number;
        recommendedActions: string[];
      }
    >();

    const routes = await listRoutes(scope.projectId, scope.userId);
    const routeSteps = await Promise.all(routes.map((r) => listRouteSteps(r.id, scope.projectId, scope.userId)));
    const allSteps = routeSteps.flat();
    const stepsByProvider = new Map<string, typeof allSteps>();
    for (const step of allSteps) {
      if (!step.providerPreference) continue;
      const arr = stepsByProvider.get(step.providerPreference) ?? [];
      arr.push(step);
      stepsByProvider.set(step.providerPreference, arr);
    }

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
        confidence: confidenceFromHealth(healthFromVerification(integration.verificationStatus)),
        lastVerifiedAt: integration.lastVerifiedAt ?? null,
        degradedReason:
          integration.verificationStatus === "failed"
            ? "verification_failed"
            : integration.verificationStatus === "pending"
              ? "verification_pending"
              : null,
        evidence: [
          integration.verificationStatus === "verified"
            ? "integration_verified"
            : "integration_unverified_or_pending",
        ],
        boundRoutes: 0,
        boundSteps: 0,
        availableModels: 0,
        recommendedActions:
          integration.verificationStatus === "verified"
            ? []
            : ["run provider verification", "confirm credential and region settings"],
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
          confidence: confidenceFromHealth(healthFromVerification(integration.verificationStatus)),
          lastVerifiedAt: integration.lastVerifiedAt ?? null,
          degradedReason:
            integration.verificationStatus === "failed"
              ? "verification_failed"
              : integration.verificationStatus === "pending"
                ? "verification_pending"
                : null,
          evidence: [
            integration.verificationStatus === "verified"
              ? "integration_verified"
              : "integration_unverified_or_pending",
          ],
          boundRoutes: 0,
          boundSteps: 0,
          availableModels: 0,
          recommendedActions:
            integration.verificationStatus === "verified"
              ? []
              : ["run provider verification", "confirm credential and region settings"],
        });
      }
    }

    const stepsCountByProvider = new Map<string, number>();
    const modelSetByProvider = new Map<string, Set<string>>();
    for (const [providerType, steps] of stepsByProvider.entries()) {
      stepsCountByProvider.set(providerType, steps.length);
      modelSetByProvider.set(
        providerType,
        new Set(steps.map((s) => s.modelId).filter((m): m is string => typeof m === "string" && m.length > 0))
      );
    }

    const routesCountByProvider = new Map<string, number>();
    for (const route of routes) {
      const steps = allSteps.filter((s) => s.routeId === route.id);
      const seen = new Set<string>();
      for (const step of steps) {
        if (!step.providerPreference) continue;
        seen.add(step.providerPreference);
      }
      for (const providerType of seen) {
        routesCountByProvider.set(providerType, (routesCountByProvider.get(providerType) ?? 0) + 1);
      }
    }

    for (const item of byIntegrationId.values()) {
      const providerType = item.providerType;
      item.boundSteps = stepsCountByProvider.get(providerType) ?? 0;
      item.boundRoutes = routesCountByProvider.get(providerType) ?? 0;
      item.availableModels = modelSetByProvider.get(providerType)?.size ?? 0;
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

