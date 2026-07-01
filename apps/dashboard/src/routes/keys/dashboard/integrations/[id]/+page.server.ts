import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { getProviderIntegration, listUsageAggregates } from "$lib/server/db";

/** Client-safe integration (no credentialRef). */
export type IntegrationDetail = {
  id: string;
  providerType: string;
  displayName: string | null;
  status: string;
  verificationStatus: string | null;
  hasCredential: boolean;
  /** Vault-reference connection: Restormel holds no key, so it cannot verify or execute it. */
  referenceOnly: boolean;
  /** Masked label when an encrypted API key is stored; never raw secret. */
  credentialMasked: string | null;
  lastVerifiedAt: number | null;
  /** Sanitized summary of the last persisted probe result (metadata.verification.detail). */
  lastVerificationDetail: string | null;
  createdAt: number;
  /** Distinct model IDs seen in usage aggregates for this provider (workspace-scoped). */
  usageModelIds: string[];
};

export const load: PageServerLoad = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) {
    return {
      integration: null,
      error: "Unauthorized" as string | null,
    };
  }
  try {
    const integration = await getProviderIntegration(params.id, ctx.workspaceId);
    if (!integration) {
      return {
        integration: null,
        error: "Not found",
      };
    }
    const usageRows = await listUsageAggregates(ctx.workspaceId, {
      providerType: integration.providerType,
      limit: 200,
    });
    const modelSeen = new Set<string>();
    for (const row of usageRows) {
      if (row.modelId) modelSeen.add(row.modelId);
    }
    const usageModelIds = [...modelSeen].sort();
    const safeIntegration: IntegrationDetail = {
      id: integration.id,
      providerType: integration.providerType,
      displayName: integration.displayName ?? null,
      status: integration.status,
      verificationStatus: integration.verificationStatus ?? null,
      hasCredential: Boolean(integration.credentialRef || integration.hasEncryptedCredential),
      referenceOnly: Boolean(integration.credentialRef && !integration.hasEncryptedCredential),
      credentialMasked: integration.credentialMasked ?? null,
      lastVerifiedAt: integration.lastVerifiedAt ?? null,
      lastVerificationDetail: (() => {
        const v = integration.metadata?.verification;
        if (v && typeof v === "object" && typeof (v as { detail?: unknown }).detail === "string") {
          return (v as { detail: string }).detail;
        }
        return null;
      })(),
      createdAt: integration.createdAt,
      usageModelIds,
    };
    return {
      integration: safeIntegration,
      error: null,
    };
  } catch (e) {
    console.error("[integrations/[id]] load failed:", e);
    return {
      integration: null,
      error: "Unable to load integration",
    };
  }
};
