import type { LayoutServerLoad } from "./$types";
import { getSocialProofMetrics } from "$lib/server/social-proof-metrics";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const path = url.pathname;
  const skipSocialFetch = path.startsWith("/keys/dashboard");
  const socialProof = skipSocialFetch ? null : await getSocialProofMetrics();

  return { user: locals.user ?? null, socialProof };
};
