/**
 * Links Restormel Testing project to provider integrations and logical model refs.
 */
import {
  createProviderBinding,
  ensureRestormelTestingProject,
  getProject,
  listEnvironments,
  listProviderBindingsByProject,
  listProviderIntegrations,
  upsertProjectModelBinding,
} from "$lib/server/db";

const PRIMARY_REF = "ref:restormel-keys:llm/primary";

const PROVIDER_PRIORITY = ["openai", "anthropic", "openrouter", "portkey", "vercel_ai_gateway"];

const DEFAULT_MODEL: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet",
  openrouter: "gpt-4o-mini",
  portkey: "gpt-4o-mini",
  vercel_ai_gateway: "gpt-4o-mini",
  other: "gpt-4o-mini",
};

function defaultModelForProvider(providerType: string): string {
  return DEFAULT_MODEL[providerType] ?? DEFAULT_MODEL.other;
}

/**
 * Ensures a Testing project exists and wires provider bindings + primary logical ref for judge/resolve.
 * Idempotent: skips bindings that already exist.
 */
export async function bootstrapRestormelTestingIntegration(userId: string, actor: { actorId: string; actorType: string }): Promise<void> {
  const project = await ensureRestormelTestingProject(userId);
  const owner = await getProject(project.id, userId);
  if (!owner?.workspaceId) return;

  const integrations = (await listProviderIntegrations(owner.workspaceId)).filter(
    (i) => i.hasEncryptedCredential && i.status === "active"
  );
  if (integrations.length === 0) return;

  const sorted = [...integrations].sort((a, b) => {
    const ia = PROVIDER_PRIORITY.indexOf(a.providerType);
    const ib = PROVIDER_PRIORITY.indexOf(b.providerType);
    const sa = ia === -1 ? 999 : ia;
    const sb = ib === -1 ? 999 : ib;
    return sa - sb;
  });

  const envs = await listEnvironments(project.id, userId);
  const devEnv = envs.find((e) => e.type === "dev") ?? envs[0];
  if (!devEnv) return;

  const existingBindings = await listProviderBindingsByProject(project.id);
  const existingIntegrationIds = new Set(existingBindings.map((b) => b.providerIntegrationId));

  let primaryDone = false;
  for (const int of sorted) {
    if (!existingIntegrationIds.has(int.id)) {
      await createProviderBinding({
        providerIntegrationId: int.id,
        projectId: project.id,
        environmentId: devEnv.id,
        workspaceId: owner.workspaceId,
        actorId: actor.actorId,
        actorType: actor.actorType,
      });
    }
    const modelId = defaultModelForProvider(int.providerType);
    const logicalRef = !primaryDone ? PRIMARY_REF : `ref:restormel-keys:llm/${int.providerType}`;
    if (!primaryDone) primaryDone = true;
    await upsertProjectModelBinding(project.id, int.providerType, modelId, "execution", logicalRef);
  }
}
