/**
 * Shared route-publish core (Phase 3 Stage 4).
 *
 * Publishing a route = promoting its working step graph to the next published
 * version, so `isRoutePublished()` (version === publishedVersion) becomes true and
 * the resolver will serve it. This is the "config deploy" the Answer Console's
 * inline publish action performs for the common case (resolving K-P0-3).
 *
 * Extracted so BOTH the per-route publish endpoint (advanced route builder) and the
 * console's bulk "publish answer config" endpoint share ONE validate→bump→audit
 * path — no duplicated publish logic, no drift in the audit trail.
 *
 * Authz is the caller's responsibility: this helper takes an already-resolved
 * (projectId, userId) scope and never widens it.
 */
import {
  getProject,
  getRouteWithSteps,
  updateRoute,
  insertRouteVersionEvent,
  insertAuditEvent,
} from "$lib/server/db";
import { validateRouteStepsForPublish } from "$lib/server/route-publish-validation";
import type { RouteRecord } from "$lib/server/neon";

export type PublishRouteResult =
  | { ok: true; publishedVersion: number; route: RouteRecord; alreadyPublished: boolean }
  | { ok: false; code: "route_not_found" }
  | {
      ok: false;
      code: "publish_validation_failed";
      errors: ReturnType<typeof validateRouteStepsForPublish>;
    };

/**
 * Validate + publish a single route within an already-authorised scope.
 *
 * `actorType` / `actorId` are recorded in the version event + audit trail exactly
 * as the per-route endpoint does. The audit write is best-effort: a publish must
 * not fail because audit logging failed.
 */
export async function publishRouteInScope(args: {
  routeId: string;
  projectId: string;
  userId: string;
  actorId: string;
  actorType: string;
}): Promise<PublishRouteResult> {
  const routeWithSteps = await getRouteWithSteps(args.routeId, args.projectId, args.userId);
  if (!routeWithSteps) return { ok: false, code: "route_not_found" };

  const publishErrors = validateRouteStepsForPublish(routeWithSteps.route, routeWithSteps.steps);
  if (publishErrors.length > 0) {
    return { ok: false, code: "publish_validation_failed", errors: publishErrors };
  }

  const nextVersion =
    Math.max(routeWithSteps.route.version ?? 1, routeWithSteps.route.publishedVersion ?? 1) + 1;

  const published = await updateRoute(args.routeId, args.projectId, args.userId, {
    version: nextVersion,
    publishedVersion: nextVersion,
    updatedVia: args.actorType,
    updatedBy: args.actorId,
    changeSummary: `Published route version ${nextVersion}`,
  });
  if (!published) return { ok: false, code: "route_not_found" };

  await insertRouteVersionEvent({
    routeId: args.routeId,
    projectId: args.projectId,
    version: nextVersion,
    action: "publish",
    actorId: args.actorId,
    actorType: args.actorType,
    summary: `Published route version ${nextVersion}`,
    routeSnapshot: published as unknown as Record<string, unknown>,
    stepsSnapshot: routeWithSteps.steps as unknown as Record<string, unknown>[],
  });

  try {
    const project = await getProject(args.projectId, args.userId);
    if (project?.workspaceId) {
      await insertAuditEvent({
        workspaceId: project.workspaceId,
        actorId: args.actorId,
        actorType: args.actorType,
        eventType: "route_published",
        targetType: "route",
        targetId: args.routeId,
        summary: `Route published (v${nextVersion})`,
      });
    }
  } catch {
    // Best effort; publishing must not fail if the audit write fails.
  }

  return { ok: true, publishedVersion: nextVersion, route: published, alreadyPublished: false };
}
