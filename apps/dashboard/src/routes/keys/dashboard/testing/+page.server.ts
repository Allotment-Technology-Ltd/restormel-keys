import { ensureRestormelTestingProject, listEnvironments, listApiKeys, getProject } from "$lib/server/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || locals.user.authType !== "session") {
    return { testingProject: null, environments: [], gatewayKeys: [], controlPlaneHint: "" };
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
      controlPlaneHint:
        "Use your site origin for RESTORMEL_KEYS_API_BASE_URL and a Gateway key as RESTORMEL_KEYS_API_TOKEN when running Restormel Testing (CLI or CI).",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[testing hub load]", msg.slice(0, 120));
    return { testingProject: null, environments: [], gatewayKeys: [], controlPlaneHint: "", loadError: "Could not load Testing project." };
  }
};
