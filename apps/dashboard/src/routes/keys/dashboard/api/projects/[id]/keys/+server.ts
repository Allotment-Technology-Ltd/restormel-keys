import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listApiKeys, createApiKey, deleteApiKey, updateApiKeyLabel } from "$lib/server/db";
import { getOrCreateDefaultWorkspace } from "$lib/server/db";
import { dashboardProjectScopeForApi } from "$lib/server/dashboard-project-api-scope";
import { ensureZuploConsumer } from "$lib/server/zuplo-consumer";
import { labelContainsKeyMaterial } from "$lib/server/key-label-validation";
import {
  isValidAccess,
  isValidConnectionType,
  normalizeTarget,
} from "$lib/server/connect/key-scope";
import { isModuleEnabled, resolveModuleFlagsSync } from "$lib/server/module-flags";

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "unauthorized", message: "Authentication required" }, { status: 401 });
  const scope = await dashboardProjectScopeForApi(locals, params.id);
  if (!scope) return json({ error: "not_found", message: "Project not found" }, { status: 404 });
  const keys = await listApiKeys(scope.projectId, scope.userId);
  // Map fields explicitly — never spread the full record in case the type gains sensitive fields.
  return json({
    data: keys.map((k) => ({
      id: k.id,
      keyPrefix: k.keyPrefix,
      createdAt: k.createdAt,
      label: k.label,
      lastUsedAt: k.lastUsedAt,
      type: "gateway" as const,
      // RES-113 PR-L — connection scope (null on legacy/flat keys). Surfaced so the M4 manager
      // renders a stored key as a typed connection. key_hash is NEVER selected/returned.
      keyType: k.keyType,
      access: k.access,
      target: k.target,
      status: k.status,
    })),
  });
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "unauthorized", message: "Authentication required" }, { status: 401 });
  const scope = await dashboardProjectScopeForApi(locals, params.id);
  if (!scope) return json({ error: "not_found", message: "Project not found" }, { status: 404 });
  // W3.7/K1: accept optional label in body (was: no body read at all — K-P1-1).
  // SECURITY: label is a human-readable string — reject anything that looks like key material.
  const body = await request.json().catch(() => ({}));
  const rawLabel = typeof body.label === "string" ? body.label.trim().slice(0, 120) : undefined;
  // Validation: label must not contain key material (rk_ anywhere in the string, not just at start).
  if (rawLabel && labelContainsKeyMaterial(rawLabel)) {
    return json({ error: "invalid_label", message: "Label must not contain key material" }, { status: 400 });
  }
  const label = rawLabel || undefined;

  // RES-113 PR-L — purpose-bind the key as a connection (REC-ADR-018 addendum: "the key IS the
  // connection"). The scope is persisted ONLY when the onboardingJourney flag is ON; flag OFF mints
  // a flat label-only key exactly as before (scope params are ignored). Invalid enum values are a
  // 400 (fail-closed) rather than silently dropping to an unscoped key, so a client asking for a
  // read key never accidentally gets a read+write one.
  const flags = locals.moduleFlags ?? resolveModuleFlagsSync();
  const scopeEnabled = isModuleEnabled(flags, "onboardingJourney");
  let keyType: "mcp" | "rest" | undefined;
  let access: "read" | "read_write" | undefined;
  let target: string | undefined;
  if (scopeEnabled) {
    if (body.keyType !== undefined && body.keyType !== null) {
      if (!isValidConnectionType(body.keyType)) {
        return json(
          { error: "invalid_key_type", message: "keyType must be 'mcp' or 'rest'" },
          { status: 400 },
        );
      }
      keyType = body.keyType;
    }
    if (body.access !== undefined && body.access !== null) {
      if (!isValidAccess(body.access)) {
        return json(
          { error: "invalid_access", message: "access must be 'read' or 'read_write'" },
          { status: 400 },
        );
      }
      access = body.access;
    }
    target = normalizeTarget(body.target) ?? undefined;
    // SECURITY: target is free text persisted + surfaced in the manager; reject anything that looks
    // like key material (same rule as labels) so a key value can never be smuggled into a stored field.
    if (target && labelContainsKeyMaterial(target)) {
      return json(
        { error: "invalid_target", message: "Target must not contain key material" },
        { status: 400 },
      );
    }
  }

  const result = await createApiKey(scope.projectId, scope.userId, {
    label,
    keyType,
    access,
    target,
  });
  if (!result) return json({ error: "not_found", message: "Project not found" }, { status: 404 });

  // Best-effort: ensure a Zuplo consumer exists for this workspace so the developer portal can "Try it".
  // Never log keys; never fail key creation if Zuplo provisioning is down.
  try {
    if (locals.user.authType !== "gateway_key" && locals.user.authType !== "management_key") {
      const ws = await getOrCreateDefaultWorkspace(locals.user.uid);
      await ensureZuploConsumer({ workspaceId: ws.id, userEmail: locals.user.email ?? null });
    }
  } catch {
    // no-op
  }

  return json(
    {
      data: {
        keyId: result.keyId,
        rawKey: result.rawKey,
        keyPrefix: result.keyPrefix,
        type: "gateway" as const,
        // Echo the persisted connection scope (null when flag OFF or not requested) so the M4
        // manager renders exactly what was minted, not a derived guess.
        keyType: keyType ?? null,
        access: access ?? null,
        target: target ?? null,
      },
    },
    { status: 201 }
  );
};

/** PATCH — rename a key's label (W3.7/K1). Body: { keyId, label: string | null }. */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "unauthorized", message: "Authentication required" }, { status: 401 });
  const scope = await dashboardProjectScopeForApi(locals, params.id);
  if (!scope) return json({ error: "not_found", message: "Project not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const keyId = typeof body.keyId === "string" ? body.keyId : undefined;
  if (!keyId) return json({ error: "invalid_request", message: "Missing keyId" }, { status: 400 });
  // null/empty string clears the label; otherwise trim + cap.
  const rawLabel = typeof body.label === "string" ? body.label.trim().slice(0, 120) : null;
  // SECURITY: reject labels that contain key material (rk_ anywhere, not just at start).
  if (rawLabel && labelContainsKeyMaterial(rawLabel)) {
    return json({ error: "invalid_label", message: "Label must not contain key material" }, { status: 400 });
  }
  const ok = await updateApiKeyLabel(scope.projectId, keyId, scope.userId, rawLabel || null);
  if (!ok) return json({ error: "not_found", message: "Key not found" }, { status: 404 });
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "unauthorized", message: "Authentication required" }, { status: 401 });
  const scope = await dashboardProjectScopeForApi(locals, params.id);
  if (!scope) return json({ error: "not_found", message: "Project not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const keyId = typeof body.keyId === "string" ? body.keyId : undefined;
  if (!keyId) return json({ error: "invalid_request", message: "Missing keyId" }, { status: 400 });
  const ok = await deleteApiKey(scope.projectId, keyId, scope.userId);
  if (!ok) return json({ error: "not_found", message: "Key not found" }, { status: 404 });
  return json({ ok: true });
};
