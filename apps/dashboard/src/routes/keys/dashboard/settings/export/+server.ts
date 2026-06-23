/**
 * GET /keys/dashboard/settings/export — "Export my data" (GDPR Art 20 portability).
 *
 * Read-only, AUDITED, ACCOUNT-SCOPED export of the signed-in account's data as a
 * portable JSON archive. Pairs with POST .../reset (Art 17 erasure): the
 * recommended flow is EXPORT-then-ERASE. This endpoint never mutates user data —
 * the only write it makes is the immutable audit_events row recording the export.
 *
 * Defence in depth (mirrors the reset endpoint's guards — same surface, same risks):
 *   1. requireSessionUser — 401 for signed-out or Bearer-key (gateway/management)
 *      requests. An export is a human, session-owner action only; a gateway or
 *      management key can NEVER pull a full account dump.
 *   2. SAME-ORIGIN check — the app sets `csrf: { trustedOrigins: ["*"] }` in
 *      svelte.config.js, which disables SvelteKit's built-in CSRF origin guard for
 *      every route. Although a GET is not a classic CSRF target, this endpoint
 *      returns the user's ENTIRE account in the response body, so we enforce
 *      same-origin HERE to stop a cross-origin page from fetch()-ing a logged-in
 *      user's data dump (the Origin header, when present on a cross-origin fetch,
 *      will not match). Same-origin top-level navigations omit Origin → we fall
 *      back to Referer, and finally allow a bare same-site navigation (no Origin,
 *      no Referer) only for a GET, since a cross-origin fetch always carries an
 *      Origin the check would reject.
 *   3. SCOPING — the workspace is resolved from the session user's id
 *      (owner_user_id); every read is parameterised by that workspace / user id,
 *      never globally. Cross-account export is impossible.
 *
 * ⚠️ The archive carries METADATA ONLY for keys and provider credentials — never
 * any secret value (no decrypted BYOK keys, no key hashes, no external-store
 * passwords). assembleAccountExport() runs a final assertNoSecretLeakage() pass.
 */

import { json, type RequestHandler } from "@sveltejs/kit";
import { getSql, getOrCreateDefaultWorkspace, insertAuditEvent } from "$lib/server/neon";
import { requireSessionUser } from "$lib/server/session-user";
import { emitAdminAction } from "$lib/server/security-events";
import { assembleAccountExport } from "$lib/server/account-export";

export const config = { runtime: "nodejs22.x" as const };

/**
 * Same-origin guard. CSRF protection is globally disabled (trustedOrigins:["*"]),
 * and this GET returns the caller's whole account, so we self-enforce. Accept when
 * the Origin header equals this request's origin; if Origin is absent fall back to
 * Referer's origin; if BOTH are absent allow (a top-level same-site navigation /
 * direct URL open carries neither, while a cross-origin fetch ALWAYS sends Origin —
 * which would then mismatch and be rejected).
 */
function isSameOriginRead(request: Request, expectedOrigin: string): boolean {
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
  // No Origin and no Referer on a GET → a same-site top-level navigation; allow.
  // (A cross-origin fetch cannot reach here: the browser always attaches Origin.)
  return true;
}

export const GET: RequestHandler = async ({ locals, request, url }) => {
  // 1. Auth — session human only (Bearer keys 401).
  const user = requireSessionUser(locals);

  // 2. Same-origin (CSRF is disabled framework-wide; enforce here).
  if (!isSameOriginRead(request, url.origin)) {
    return json({ ok: false, error: "forbidden_origin" }, { status: 403 });
  }

  // 3. Resolve the user's OWN workspace (owner_user_id). This is the scope key.
  const workspace = await getOrCreateDefaultWorkspace(user.uid);

  const sql = getSql();

  // 4. Assemble the scoped, read-only, secret-free archive.
  let archive;
  try {
    archive = await assembleAccountExport(sql, {
      workspaceId: workspace.id,
      userId: user.uid,
      email: user.email ?? null,
    });
  } catch (err) {
    // Never echo DB internals to the client.
    console.error("[account-export] failed", { uid: user.uid.slice(0, 8), err });
    return json({ ok: false, error: "export_failed" }, { status: 500 });
  }

  // 5. Immutable audit row — record WHO exported WHAT, WHEN (no data contents).
  try {
    await insertAuditEvent({
      workspaceId: workspace.id,
      actorId: user.uid,
      actorType: "user",
      eventType: "account_data_export",
      targetType: "workspace",
      targetId: workspace.id,
      summary: `Account data export (Art 20); ${Object.entries(archive.counts)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
    });
  } catch (err) {
    // Audit is best-effort: the export already happened (read-only). Log loudly.
    console.error("[account-export] audit write failed (export already produced)", err);
  }

  // 6. Out-of-band security telemetry (PostHog) — opaque IDs only, no PII.
  emitAdminAction({
    workspaceId: workspace.id,
    actorId: user.uid,
    eventType: "account_data_export",
    targetType: "workspace",
  });

  // 7. Stream the archive as a downloadable JSON attachment.
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `restormel-account-export-${stamp}.json`;
  const bodyText = JSON.stringify(archive, null, 2);
  return new Response(bodyText, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      // Never let a downloaded account dump be cached by intermediaries.
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
};
