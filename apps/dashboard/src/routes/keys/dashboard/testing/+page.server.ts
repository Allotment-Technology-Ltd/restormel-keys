import {
  ensureRestormelTestingProject,
  listEnvironments,
  listApiKeys,
  getProject,
} from "$lib/server/db";
import { listTestingVerdicts } from "$lib/server/neon";
import type { TestingVerdictEntry } from "@restormel/contracts";
import type { PageServerLoad } from "./$types";

/**
 * W3.8: testing hub page server load.
 *
 * The `testingHistory` field is a streamed Promise (SvelteKit streaming) so the
 * page shell and setup cards render immediately while the verdict timeline loads.
 * Per ux-contracts §3: the component handles loading / error / empty states.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
  const keysApiBaseUrl = url.origin;
  if (!locals.user || locals.user.authType !== "session") {
    return {
      testingProject: null,
      environments: [],
      gatewayKeys: [],
      controlPlaneHint: "",
      keysApiBaseUrl,
      // Streamed — resolves to empty for signed-out users; component shows sign-in state.
      testingHistory: Promise.resolve([] as TestingVerdictEntry[]),
    };
  }

  let testingProject: Awaited<ReturnType<typeof ensureRestormelTestingProject>> | null = null;
  let environments: Awaited<ReturnType<typeof listEnvironments>> = [];
  let gatewayKeys: Awaited<ReturnType<typeof listApiKeys>> = [];
  let fullProject: Awaited<ReturnType<typeof getProject>> = null;
  let loadError: string | undefined;

  try {
    testingProject = await ensureRestormelTestingProject(locals.user.uid);
    const [envs, keys, full] = await Promise.all([
      listEnvironments(testingProject.id, locals.user.uid),
      listApiKeys(testingProject.id, locals.user.uid),
      getProject(testingProject.id, locals.user.uid),
    ]);
    environments = envs;
    gatewayKeys = keys;
    fullProject = full;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[testing hub load]", msg.slice(0, 120));
    loadError = "Could not load Testing project.";
  }

  // Resolve workspace id for the verdict timeline.
  const workspaceId = fullProject?.workspaceId ?? testingProject?.workspaceId ?? null;

  /**
   * Streamed verdict history — resolves independently of the project load above.
   * The component renders BrutalLoadingState while this Promise is pending, then
   * transitions to the timeline (or EmptyState / BrutalErrorBanner on rejection).
   */
  const testingHistory: Promise<TestingVerdictEntry[]> = workspaceId
    ? listTestingVerdicts({ workspaceId, limit: 25 }).then((rows) =>
        rows.map((row) => ({
          id: row.id,
          workspace_id: row.workspaceId,
          recorded_at: row.recordedAt,
          verdict: row.verdict as TestingVerdictEntry["verdict"],
        }))
      )
    : Promise.resolve([]);

  return {
    testingProject: fullProject,
    environments,
    gatewayKeys,
    keysApiBaseUrl,
    controlPlaneHint:
      "Copy the block below: RESTORMEL_KEYS_BASE is this deployment's origin (scheme + host, no path). Use a Gateway key as RESTORMEL_GATEWAY_KEY (alias RESTORMEL_KEYS_API_* still works).",
    loadError,
    // Streamed — timeline resolves asynchronously.
    testingHistory,
  };
};
