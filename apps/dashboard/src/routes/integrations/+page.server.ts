import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { listProviderIntegrations } from "$lib/server/db";

/** Safe shape for client: no credentialRef. */
export type IntegrationSummary = {
  id: string;
  workspaceId: string;
  providerType: string;
  displayName: string | null;
  status: string;
  verificationStatus: string | null;
  hasCredential: boolean;
  createdAt: number;
  lastVerifiedAt: number | null;
};

export const load: PageServerLoad = async ({ locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) {
    return { integrations: [] as IntegrationSummary[], error: null as string | null };
  }
  try {
    const list = await listProviderIntegrations(ctx.workspaceId);
    const integrations: IntegrationSummary[] = list.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      providerType: r.providerType,
      displayName: r.displayName ?? null,
      status: r.status,
      verificationStatus: r.verificationStatus ?? null,
      hasCredential: !!r.credentialRef,
      createdAt: r.createdAt,
      lastVerifiedAt: r.lastVerifiedAt ?? null,
    }));
    return { integrations, error: null };
  } catch (e) {
    console.error("[integrations] load failed:", e);
    return { integrations: [] as IntegrationSummary[], error: "Unable to load integrations" };
  }
};
