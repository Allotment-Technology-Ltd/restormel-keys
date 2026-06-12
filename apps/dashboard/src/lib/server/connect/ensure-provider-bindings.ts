/**
 * Idempotent provider→project binding creation (Stage K3, closing K-P0-2's "created
 * nowhere on the Connect path"). Mirrors testing-bootstrap's auto-bind: for each
 * canonical provider, if the routing project has no binding for it, bind the best
 * matching workspace integration (active + stored credential).
 *
 * Used by applyRecommendedIngestionRoutes so the providers it wires into stage routes
 * are executable at run time, not just routable.
 */
import {
  createProviderBinding,
  listProviderBindingsByProject,
  listProviderIntegrations,
} from "$lib/server/db";
import { normalizeProviderToCanonicalApi } from "$lib/server/canonical-provider";

export type EnsureProviderBindingsDeps = {
  listProviderIntegrations: typeof listProviderIntegrations;
  listProviderBindingsByProject: typeof listProviderBindingsByProject;
  createProviderBinding: typeof createProviderBinding;
};

const defaultDeps: EnsureProviderBindingsDeps = {
  listProviderIntegrations,
  listProviderBindingsByProject,
  createProviderBinding,
};

export type EnsuredProviderBinding = {
  provider: string;
  integrationId: string;
  /** false when the binding already existed (idempotent no-op). */
  created: boolean;
};

/**
 * Ensure a provider_bindings row exists on `projectId` for each canonical provider in
 * `providers`. Returns one entry per provider that has (or now has) a binding; providers
 * with no eligible workspace integration are silently skipped — the run preflight
 * surfaces those with a "Connect <provider>" repair link instead.
 */
export async function ensureProviderBindingsForProviders(
  args: {
    workspaceId: string;
    projectId: string;
    environmentId?: string | null;
    providers: string[];
    actorId: string;
    actorType: string;
  },
  deps: EnsureProviderBindingsDeps = defaultDeps,
): Promise<EnsuredProviderBinding[]> {
  const wanted = new Set(
    args.providers
      .map((p) => normalizeProviderToCanonicalApi(p))
      .filter((p): p is string => Boolean(p)),
  );
  if (wanted.size === 0) return [];

  const [integrations, bindings] = await Promise.all([
    deps.listProviderIntegrations(args.workspaceId).catch(() => []),
    deps.listProviderBindingsByProject(args.projectId).catch(() => []),
  ]);

  const boundByProvider = new Map<string, string>();
  for (const b of bindings) {
    const canonical = normalizeProviderToCanonicalApi(b.integration?.providerType);
    if (canonical && b.integration?.id && !boundByProvider.has(canonical)) {
      boundByProvider.set(canonical, b.integration.id);
    }
  }

  const out: EnsuredProviderBinding[] = [];
  for (const provider of wanted) {
    const existing = boundByProvider.get(provider);
    if (existing) {
      out.push({ provider, integrationId: existing, created: false });
      continue;
    }
    const candidate = integrations.find(
      (i) =>
        normalizeProviderToCanonicalApi(i.providerType) === provider &&
        i.hasEncryptedCredential === true &&
        i.status === "active",
    );
    if (!candidate) continue;
    const created = await deps
      .createProviderBinding({
        providerIntegrationId: candidate.id,
        projectId: args.projectId,
        environmentId: args.environmentId ?? null,
        workspaceId: args.workspaceId,
        actorId: args.actorId,
        actorType: args.actorType,
      })
      .catch(() => null);
    if (created) {
      out.push({ provider, integrationId: candidate.id, created: true });
      boundByProvider.set(provider, candidate.id);
    }
  }
  return out;
}
