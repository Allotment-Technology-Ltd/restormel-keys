import { redirect } from "@sveltejs/kit";

/**
 * The persona "Choose your path" cards now live on the unified Tutorials hub.
 * The individual /keys/docs/journeys/<persona> pages stay put (external links,
 * suite-module embedHref); only the bare index folds into the one spine.
 */
export function load() {
  redirect(308, "/keys/docs/tutorials");
}
