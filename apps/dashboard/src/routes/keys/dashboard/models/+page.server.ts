import type { PageServerLoad } from "./$types";
import { listModels } from "$lib/server/db";

export const load: PageServerLoad = async ({ url }) => {
  const lifecycleState = url.searchParams.get("lifecycleState")?.trim() || undefined;
  const family = url.searchParams.get("family")?.trim() || undefined;
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  try {
    const data = await listModels({ lifecycleState, family, limit, offset });
    return { models: data, error: null as string | null };
  } catch (e) {
    console.error("[models] load failed:", e);
    return { models: [], error: "Unable to load model catalog" };
  }
};
