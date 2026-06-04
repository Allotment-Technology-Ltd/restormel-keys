/**
 * POST /v1/testing/resolve-model — Restormel Testing model resolution (Gateway key auth).
 * Returns provider/model and optional inline API key when credentials are stored encrypted in Connections.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import { decryptProviderSecret } from "$lib/server/credential-crypto";
import {
  getProviderIntegrationSecretRow,
  getProjectModelBindingByLogicalRef,
  listProviderBindingsByProject,
} from "$lib/server/db";

export const POST: RequestHandler = async ({ request, locals }) => {
  const flags = locals.moduleFlags ?? MVP_MODULE_DEFAULTS;
  if (!flags.testing) {
    return json({ error: "module_disabled", module: "testing" }, { status: 404 });
  }

  if (!locals.user) {
    return json({ error: "unauthorized", message: "Unauthorized" }, { status: 401 });
  }
  if (locals.user.authType !== "gateway_key" || !locals.user.projectIdForKey) {
    return json(
      {
        error: "gateway_key_required",
        message: "Use a project Gateway key (rk_…) as Bearer token for this endpoint",
      },
      { status: 401 }
    );
  }

  let body: { logicalRef?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }
  const logicalRef = typeof body.logicalRef === "string" ? body.logicalRef.trim() : "";
  if (!logicalRef.startsWith("ref:restormel-keys:")) {
    return json({ error: "invalid_ref", message: "Expected ref:restormel-keys:…" }, { status: 400 });
  }

  const projectId = locals.user.projectIdForKey;
  const pmb = await getProjectModelBindingByLogicalRef(projectId, logicalRef);
  if (!pmb) {
    return json(
      {
        error: "unknown_ref",
        message:
          "No model binding for this logical ref. Open Keys → Connections, add a provider API key, and ensure the Restormel Testing project is linked.",
      },
      { status: 404 }
    );
  }

  const bindings = await listProviderBindingsByProject(projectId);
  const match = bindings.find((b) => b.integration?.providerType === pmb.providerType);
  if (!match?.integration?.id || !match.integration.workspaceId) {
    return json(
      { error: "no_provider_binding", message: "Link the provider to this project under Connections" },
      { status: 422 }
    );
  }

  const row = await getProviderIntegrationSecretRow(match.integration.id, match.integration.workspaceId);
  if (!row) {
    return json({ error: "integration_not_found" }, { status: 404 });
  }

  const dec = decryptProviderSecret({
    credentialCiphertext: row.credentialCiphertext,
    credentialIv: row.credentialIv,
    credentialAuthTag: row.credentialAuthTag,
    encryptionVersion: row.credentialEncryptionVersion,
  });
  if (!dec.ok) {
    return json(
      { error: "credential_unavailable", message: "Could not decrypt provider credential; re-save the key in Connections" },
      { status: 422 }
    );
  }

  return json({
    provider: pmb.providerType,
    model: pmb.modelId,
    secretEnvVar: "RESTORMEL_HOSTED_INLINE",
    inlineApiKey: dec.secret,
  });
};
