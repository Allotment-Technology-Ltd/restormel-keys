import { ensureRestormelTestingProject, listEnvironments, listApiKeys, getProject } from "$lib/server/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  const keysApiBaseUrl = url.origin;
  if (!locals.user || locals.user.authType !== "session") {
    return {
      testingProject: null,
      environments: [],
      gatewayKeys: [],
      controlPlaneHint: "",
      keysApiBaseUrl,
    };
  }
  try {
    const testingProject = await ensureRestormelTestingProject(locals.user.uid);
    const envs = await listEnvironments(testingProject.id, locals.user.uid);
    const keys = await listApiKeys(testingProject.id, locals.user.uid);
    const full = await getProject(testingProject.id, locals.user.uid);
    return {
      testingProject: full,
      environments: envs,
      gatewayKeys: keys,
      keysApiBaseUrl,
      controlPlaneHint:
        "Copy the block below: RESTORMEL_KEYS_BASE is this deployment’s origin (scheme + host, no path). Use a Gateway key as RESTORMEL_GATEWAY_KEY (alias RESTORMEL_KEYS_API_* still works).",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[testing hub load]", msg.slice(0, 120));
    return {
      testingProject: null,
      environments: [],
      gatewayKeys: [],
      controlPlaneHint: "",
      keysApiBaseUrl,
      loadError: "Could not load Testing project.",
    };
  }
};
