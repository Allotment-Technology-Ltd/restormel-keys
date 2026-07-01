/**
 * Hosted runtime invoke (Phase 1): credential lookup for resolved provider + message validation.
 */
import { decryptProviderSecret } from "$lib/server/credential-crypto";
import {
  getProviderIntegrationSecretRow,
  listProviderBindingsByProject,
  listProviderIntegrations,
} from "$lib/server/db";
import { normalizeProviderToCanonicalApi } from "$lib/server/canonical-provider";
import type { ChatMessage } from "$lib/server/runtime-openai-chat";

const MESSAGE_ROLES = new Set(["system", "user", "assistant", "developer"]);

export function parseChatMessages(body: unknown): { ok: true; messages: ChatMessage[] } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "invalid_body" };
  const m = (body as Record<string, unknown>).messages;
  if (!Array.isArray(m) || m.length === 0) return { ok: false, error: "messages_required" };
  const out: ChatMessage[] = [];
  for (const row of m) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false, error: "invalid_message" };
    const r = row as Record<string, unknown>;
    const role = typeof r.role === "string" ? r.role.trim() : "";
    const content = typeof r.content === "string" ? r.content : "";
    if (!role || content === "") return { ok: false, error: "invalid_message" };
    if (!MESSAGE_ROLES.has(role)) return { ok: false, error: "invalid_message_role" };
    out.push({ role, content });
  }
  return { ok: true, messages: out };
}

export async function findDecryptedApiKeyForResolvedProvider(args: {
  projectId: string;
  workspaceId: string;
  resolvedCanonicalProvider: string | null;
}): Promise<
  | { ok: true; apiKey: string }
  | { ok: false; code: "no_provider" | "no_provider_binding" | "integration_not_found" | "credential_unavailable" }
> {
  const target = normalizeProviderToCanonicalApi(args.resolvedCanonicalProvider);
  if (!target) {
    return { ok: false, code: "no_provider" };
  }
  const bindings = await listProviderBindingsByProject(args.projectId);
  const match = bindings.find((b) => {
    if (!b.integration?.id) return false;
    const pt = normalizeProviderToCanonicalApi(b.integration.providerType);
    return pt === target;
  });

  // RES-154: a key is workspace-available by default. An explicit provider_bindings
  // row is only needed to *override* which key a project uses when the workspace
  // holds more than one integration for the same provider family — it is no longer
  // required just to make a newly-added key usable. When no binding matches, fall
  // back to any active, decryptable workspace integration for this provider (most
  // recently created first, per listProviderIntegrations' ORDER BY created_at DESC).
  let integrationId = match?.integration?.id ?? null;
  if (!integrationId) {
    const integrations = await listProviderIntegrations(args.workspaceId).catch(() => []);
    const fallback = integrations.find(
      (i) =>
        normalizeProviderToCanonicalApi(i.providerType) === target &&
        i.hasEncryptedCredential === true &&
        i.status === "active",
    );
    integrationId = fallback?.id ?? null;
  }
  if (!integrationId) {
    return { ok: false, code: "no_provider_binding" };
  }
  const row = await getProviderIntegrationSecretRow(integrationId, args.workspaceId);
  if (!row) {
    return { ok: false, code: "integration_not_found" };
  }
  const dec = decryptProviderSecret({
    credentialCiphertext: row.credentialCiphertext,
    credentialIv: row.credentialIv,
    credentialAuthTag: row.credentialAuthTag,
    encryptionVersion: row.credentialEncryptionVersion,
  });
  if (!dec.ok) {
    return { ok: false, code: "credential_unavailable" };
  }
  return { ok: true, apiKey: dec.secret };
}
