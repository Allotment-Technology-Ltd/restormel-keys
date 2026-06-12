import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  checkIntegrationVerifyRateLimit,
  runIntegrationVerificationProbe,
  type IntegrationVerifyCredential,
} from "$lib/server/integration-verify";
import { decryptProviderSecret } from "$lib/server/credential-crypto";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import {
  getProviderIntegration,
  getProviderIntegrationSecretRow,
  updateProviderVerification,
} from "$lib/server/db";

/**
 * POST: run a real provider verification probe (Stage K2).
 *
 * The hosted key is decrypted server-side, sent only as the provider auth header, and never
 * logged or echoed. Indeterminate outcomes (network errors) do NOT overwrite the stored
 * verification status — a good key is never marked bad because of a blip. User-initiated only;
 * rate-limited per integration so a stuck button cannot hammer the provider.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const integration = await getProviderIntegration(params.id, ctx.workspaceId);
  if (!integration) return json({ error: "Not found" }, { status: 404 });

  // Auth first, then the per-credential budget (5/min default).
  const rate = checkIntegrationVerifyRateLimit(integration.id);
  if (!rate.allowed) {
    return json(
      {
        error: "rate_limited",
        message: `Verification was run too recently. Try again in ${rate.retryAfterSeconds}s.`,
        retryAfterSeconds: rate.retryAfterSeconds,
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let credential: IntegrationVerifyCredential;
  if (integration.hasEncryptedCredential) {
    const row = await getProviderIntegrationSecretRow(integration.id, ctx.workspaceId);
    const dec = row
      ? decryptProviderSecret({
          credentialCiphertext: row.credentialCiphertext,
          credentialIv: row.credentialIv,
          credentialAuthTag: row.credentialAuthTag,
          encryptionVersion: row.credentialEncryptionVersion,
        })
      : null;
    if (!dec?.ok) {
      // Server-side decrypt problem (key missing/rotated) — not the user's credential being
      // invalid. Do not overwrite the stored status.
      return json({
        data: {
          verificationStatus: integration.verificationStatus,
          lastVerifiedAt: integration.lastVerifiedAt,
          resultKind: "credential_unavailable",
          verificationDetail:
            "The stored key could not be decrypted on this deployment (encryption key missing or rotated). Re-enter the credential or contact your admin. The key was NOT marked invalid.",
        },
      });
    }
    credential = { mode: "encrypted", apiKey: dec.secret };
  } else if (integration.credentialRef) {
    credential = { mode: "reference" };
  } else {
    credential = { mode: "none" };
  }

  const outcome = await runIntegrationVerificationProbe({
    providerType: integration.providerType,
    credential,
  });

  if (!outcome.persistStatus) {
    // Indeterminate (network_error): report, but keep the previously stored state.
    return json({
      data: {
        verificationStatus: integration.verificationStatus,
        lastVerifiedAt: integration.lastVerifiedAt,
        resultKind: outcome.resultKind,
        verificationDetail: outcome.detail,
      },
    });
  }

  const updated = await updateProviderVerification(
    params.id,
    ctx.workspaceId,
    outcome.verificationStatus,
    ctx.actorId,
    ctx.actorType,
    { resultKind: outcome.resultKind, detail: outcome.detail }
  );
  if (!updated) return json({ error: "Not found" }, { status: 404 });
  return json({
    data: {
      verificationStatus: updated.verificationStatus,
      lastVerifiedAt: updated.lastVerifiedAt,
      resultKind: outcome.resultKind,
      verificationDetail: outcome.detail,
    },
  });
};
