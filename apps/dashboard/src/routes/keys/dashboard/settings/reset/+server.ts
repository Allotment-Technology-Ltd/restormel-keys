/**
 * POST /keys/dashboard/settings/reset — "Reset to day-0 / clear all my data".
 *
 * Destructive, AUDITED, ACCOUNT-SCOPED erasure of the signed-in account's data.
 * Used for (a) a clean first-time-user test and (b) GDPR Art 17 right-to-erasure.
 *
 * Defence in depth (this is the most destructive endpoint in the app):
 *   1. requireSessionUser — 401 for signed-out or Bearer-key requests. A reset is
 *      a human, session-owner action only; a gateway/management key can NEVER
 *      trigger it.
 *   2. SAME-ORIGIN check — the app sets `csrf: { trustedOrigins: ["*"] }` in
 *      svelte.config.js (so the OIDC token endpoint can take cross-origin form
 *      POSTs), which DISABLES SvelteKit's built-in CSRF origin guard for every
 *      route. We therefore enforce same-origin HERE explicitly: the Origin (or,
 *      fallback, Referer) header must match this request's origin, else 403. This
 *      stops a malicious page from POSTing a logged-in user's cookies into a wipe.
 *   3. TYPE-TO-CONFIRM — the JSON body must carry `confirm === RESET_CONFIRM_PHRASE`
 *      ("reset my account"), a deliberate second factor against accidental/forged
 *      submission, else 400.
 *   4. SCOPING — the workspace is resolved from the session user's id
 *      (owner_user_id); every delete is parameterised by that workspace (and the
 *      user id), never globally. A project-scoped reset validates the project
 *      belongs to the user's workspace before deleting.
 *
 * On a full account reset we recreate a fresh empty default workspace so the user
 * lands on a genuine day-0 first-run state, and write an immutable audit_events
 * row (to the NEW workspace, since the old one is deleted) recording who/when/what.
 */

import { json, type RequestHandler } from "@sveltejs/kit";
import { getSql, getOrCreateDefaultWorkspace, getProjectInWorkspace, insertAuditEvent } from "$lib/server/neon";
import { requireSessionUser } from "$lib/server/session-user";
import { emitAdminAction } from "$lib/server/security-events";
import {
  executeAccountReset,
  RESET_CONFIRM_PHRASE,
  type ResetScope,
} from "$lib/server/account-reset";

export const config = { runtime: "nodejs22.x" as const };

/**
 * Same-origin guard. CSRF protection is globally disabled (trustedOrigins:["*"]),
 * so destructive mutations must self-enforce. We accept the request only if the
 * Origin header equals this request's origin; if Origin is absent (some same-origin
 * navigations omit it) we fall back to checking Referer's origin. A cross-site
 * forgery carries the attacker's Origin/Referer and is rejected.
 */
function isSameOrigin(request: Request, expectedOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }
  // No Origin and no Referer on a state-changing POST → reject (fail closed).
  return false;
}

interface ResetBody {
  confirm?: string;
  scope?: ResetScope;
  projectId?: string;
  /** GDPR Art 17 hard-erasure of the user-scoped consent ledger too. */
  eraseUserScopedData?: boolean;
}

export const POST: RequestHandler = async ({ locals, request, url }) => {
  // 1. Auth — session human only.
  const user = requireSessionUser(locals);

  // 2. Same-origin (CSRF is disabled framework-wide; enforce here).
  if (!isSameOrigin(request, url.origin)) {
    return json({ ok: false, error: "forbidden_origin" }, { status: 403 });
  }

  // Parse body.
  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
  } catch {
    return json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // 3. Type-to-confirm.
  if ((body.confirm ?? "").trim().toLowerCase() !== RESET_CONFIRM_PHRASE) {
    return json({ ok: false, error: "confirm_required", expected: RESET_CONFIRM_PHRASE }, { status: 400 });
  }

  const scope: ResetScope = body.scope === "project" ? "project" : "account";

  // 4. Resolve the user's OWN workspace (owner_user_id). This is the scope key.
  const workspace = await getOrCreateDefaultWorkspace(user.uid);

  // For a project-scoped reset, validate the project belongs to THIS workspace.
  let projectId: string | undefined;
  if (scope === "project") {
    projectId = (body.projectId ?? "").trim();
    if (!projectId) {
      return json({ ok: false, error: "project_id_required" }, { status: 400 });
    }
    const project = await getProjectInWorkspace(projectId, workspace.id);
    if (!project) {
      // Either nonexistent or not owned by this workspace → 404 (don't leak which).
      return json({ ok: false, error: "project_not_found" }, { status: 404 });
    }
  }

  const sql = getSql();

  // 5. Execute the scoped, atomic deletion.
  let result;
  try {
    result = await executeAccountReset(sql, {
      workspaceId: workspace.id,
      userId: user.uid,
      scope,
      projectId,
      eraseUserScopedData: body.eraseUserScopedData === true,
    });
  } catch (err) {
    // Never echo DB internals to the client.
    console.error("[account-reset] failed", { uid: user.uid.slice(0, 8), scope, err });
    return json({ ok: false, error: "reset_failed" }, { status: 500 });
  }

  // 6. Day-0 recreation + immutable audit.
  //    - account scope: the workspace row was deleted; recreate a fresh empty
  //      default so the user lands on a clean first-run, and audit to the NEW one.
  //    - project scope: the workspace still exists; audit to it directly.
  let newWorkspaceId = workspace.id;
  let auditWorkspaceId = workspace.id;
  if (scope === "account") {
    const fresh = await getOrCreateDefaultWorkspace(user.uid);
    newWorkspaceId = fresh.id;
    auditWorkspaceId = fresh.id;
  }

  try {
    await insertAuditEvent({
      workspaceId: auditWorkspaceId,
      actorId: user.uid,
      actorType: "user",
      eventType: scope === "account" ? "account_reset_day0" : "project_reset",
      targetType: scope === "account" ? "workspace" : "project",
      targetId: scope === "account" ? result.clearedWorkspaceId : (projectId ?? ""),
      summary:
        scope === "account"
          ? `Account reset to day-0 (Art 17 erasure=${body.eraseUserScopedData === true}); cleared workspace ${result.clearedWorkspaceId}`
          : `Project ${projectId} reset to day-0`,
    });
  } catch (err) {
    // Audit is mandatory for erasure, but the data IS already gone — do not fail
    // the request (that would imply nothing happened). Log loudly instead.
    console.error("[account-reset] audit write failed (data already cleared)", err);
  }

  // 7. Out-of-band security telemetry (PostHog) — opaque IDs only, no PII.
  emitAdminAction({
    workspaceId: result.clearedWorkspaceId,
    actorId: user.uid,
    eventType: scope === "account" ? "account_reset_day0" : "project_reset",
    targetType: scope === "account" ? "workspace" : "project",
  });

  return json({
    ok: true,
    scope,
    clearedWorkspaceId: result.clearedWorkspaceId,
    newWorkspaceId: scope === "account" ? newWorkspaceId : undefined,
    clearedTables: Object.keys(result.deleted),
  });
};
