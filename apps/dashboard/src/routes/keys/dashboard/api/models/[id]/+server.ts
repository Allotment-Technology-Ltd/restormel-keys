import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getModel, listProviderModelVariants } from "$lib/server/db";

/** GET: model detail with provider variants (catalog object for frontend). Public read. */
export const GET: RequestHandler = async ({ params }) => {
  const model = await getModel(params.id);
  if (!model) return json({ error: "Not found" }, { status: 404 });
  const variants = await listProviderModelVariants(params.id);
  return json({
    data: {
      ...model,
      variants,
    },
  });
};
