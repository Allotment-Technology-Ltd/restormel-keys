import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { dashboardLoginHref } from "$lib/dashboard-entry";
import { isUseCaseId } from "$lib/content/use-cases";

const PIPELINE_DOMAIN_REDIRECT = `${DASHBOARD_BASE}/sources/ingest?step=domain`;

/** Marketing CTA → login with safe post-auth redirect and template id. */
export function useCaseTemplateLoginHref(templateId: string): string {
  if (!isUseCaseId(templateId)) {
    return dashboardLoginHref();
  }
  const params = new URLSearchParams({
    redirect: PIPELINE_DOMAIN_REDIRECT,
    template: templateId,
  });
  return `${dashboardLoginHref()}?${params.toString()}`;
}
