/**
 * POST: record crowd-observed provider signals (e.g. model deprecated by vendor API).
 * Auth: session, Gateway Key, or Management Key — not anonymous (reduces abuse).
 * Data minimisation: store short error codes only; no raw provider bodies or secrets.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getOrCreateDefaultWorkspace,
  getProjectById,
  upsertCatalogModelObservation,
} from "$lib/server/db";
import { isProviderModelInDefaultAllowlist, buildDefaultProviderModelAllowlist } from "@restormel/keys";

const ALLOWLIST = buildDefaultProviderModelAllowlist();

async function resolveWorkspaceId(locals: App.Locals): Promise<string | null> {
  if (!locals.user) return null;
  if (locals.user.authType === "gateway_key" && locals.user.projectIdForKey) {
    const project = await getProjectById(locals.user.projectIdForKey);
    return project?.workspaceId ?? null;
  }
  if (locals.user.authType === "management_key" && locals.user.workspaceId) {
    return locals.user.workspaceId;
  }
  if (locals.user.uid) {
    const ws = await getOrCreateDefaultWorkspace(locals.user.uid);
    return ws.id;
  }
  return null;
}

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    providerId?: string;
    providerModelId?: string;
    signal?: string;
    providerHttpStatus?: number;
    providerErrorCode?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const providerId = typeof body.providerId === "string" ? body.providerId.trim() : "";
  const providerModelId = typeof body.providerModelId === "string" ? body.providerModelId.trim() : "";
  const signalRaw = typeof body.signal === "string" ? body.signal.trim().toLowerCase() : "";

  if (!providerId || !providerModelId) {
    return json({ error: "providerId and providerModelId are required" }, { status: 400 });
  }

  if (signalRaw !== "deprecated" && signalRaw !== "retired") {
    return json({ error: "signal must be deprecated or retired" }, { status: 400 });
  }

  if (!isProviderModelInDefaultAllowlist(providerId, providerModelId, ALLOWLIST)) {
    return json(
      {
        error: "unknown_provider_model",
        message: "Pair is not in the current @restormel/keys default provider catalog.",
      },
      { status: 400 }
    );
  }

  const workspaceId = await resolveWorkspaceId(locals);
  if (!workspaceId) {
    return json({ error: "workspace_unavailable" }, { status: 403 });
  }

  const providerHttpStatus =
    typeof body.providerHttpStatus === "number" && Number.isFinite(body.providerHttpStatus)
      ? Math.trunc(body.providerHttpStatus)
      : null;
  const providerErrorCode =
    typeof body.providerErrorCode === "string" ? body.providerErrorCode.trim().slice(0, 128) : null;

  try {
    await upsertCatalogModelObservation({
      catalogProviderId: providerId,
      providerModelId,
      signal: signalRaw,
      workspaceId,
      providerHttpStatus,
      providerErrorCode: providerErrorCode || null,
    });
  } catch (e) {
    console.error("[catalog/observations] upsert failed:", e);
    return json({ error: "internal_error", detail: "observation_write_failed" }, { status: 500 });
  }

  return json({
    data: {
      ok: true,
      providerId,
      providerModelId,
      signal: signalRaw,
    },
  });
};
