import type { PageServerLoad } from "./$types";
import { getModel, listProviderModelVariants } from "$lib/server/db";

export const load: PageServerLoad = async ({ params }) => {
  try {
    const model = await getModel(params.id);
    if (!model) return { model: null, variants: [], error: "Not found" as string | null };
    const variants = await listProviderModelVariants(params.id);
    return { model, variants, error: null };
  } catch (e) {
    console.error("[models/[id]] load failed:", e);
    return { model: null, variants: [], error: "Unable to load model" };
  }
};
