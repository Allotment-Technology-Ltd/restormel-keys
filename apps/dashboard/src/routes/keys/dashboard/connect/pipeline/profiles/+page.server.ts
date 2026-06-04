import { redirect } from "@sveltejs/kit";
import { pipelineWizardHref } from "$lib/connect/pipeline-config";

export const load = () => {
  throw redirect(302, pipelineWizardHref("ready"));
};
