import type { LayoutServerLoad } from "./$types";
import { getSocialProofMetrics } from "$lib/server/social-proof-metrics";

/** Node serverless for marketing + docs (social proof fetch, session in hooks). */
export const config = { runtime: "nodejs22.x" as const };

export const load: LayoutServerLoad = async ({ locals, url }) => {
  try {
    const path = url.pathname;
    const skipSocialFetch = path.startsWith("/keys/dashboard");
    const socialProof = skipSocialFetch ? null : await getSocialProofMetrics();
    return { user: locals.user ?? null, socialProof };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[layout] root load failed:", msg.slice(0, 200));
    return { user: locals.user ?? null, socialProof: null };
  }
};
