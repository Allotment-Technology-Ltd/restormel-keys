import type { LayoutServerLoad } from "./$types";
import { getSocialProofMetrics } from "$lib/server/social-proof-metrics";
import { filterSuiteModulesForFlags } from "$lib/server/module-gates";

/** Node serverless for marketing + docs (social proof fetch, session in hooks). */
export const config = { runtime: "nodejs22.x" as const };

export const load: LayoutServerLoad = async ({ locals, url }) => {
  try {
    const path = url.pathname;
    const skipSocialFetch = path.startsWith("/keys/dashboard") || path.startsWith("/keys/admin");
    const socialProof = skipSocialFetch ? null : await getSocialProofMetrics();
    const moduleFlags = locals.moduleFlags ?? null;
    const suiteModulesForUi = moduleFlags ? filterSuiteModulesForFlags(moduleFlags) : undefined;
    return { user: locals.user ?? null, socialProof, moduleFlags, suiteModulesForUi };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[layout] root load failed:", msg.slice(0, 200));
    return { user: locals.user ?? null, socialProof: null, moduleFlags: locals.moduleFlags ?? null };
  }
};
