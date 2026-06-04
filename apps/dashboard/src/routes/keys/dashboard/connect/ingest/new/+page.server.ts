import { redirect } from "@sveltejs/kit";
import { pipelineWizardHref } from "$lib/connect/pipeline-config";

/** Standalone job form retired — new runs start from the pipeline wizard. */
export function load() {
  throw redirect(302, pipelineWizardHref("run"));
}
