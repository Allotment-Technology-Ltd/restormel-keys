import { json } from "@sveltejs/kit";
import { ROUTE_STEP_ALLOWED_STORAGE_PROVIDERS } from "$lib/server/canonical-provider";

/** 400 when `providerPreference` is a string but not an allowed route-step execution slug (distinct from typos in other fields). */
export function jsonRouteStepProviderNotAllowed() {
  const allowed = [...ROUTE_STEP_ALLOWED_STORAGE_PROVIDERS].sort();
  return json(
    {
      error: "route_step_provider_not_allowed",
      detail: `providerPreference must be one of: ${allowed.join(", ")} (aliases: vertex → google). Values that appear only on the project model index (for example registry bindings) are not accepted on route steps until Keys adds execution for them. For models reached via an aggregator, use openrouter or portkey with a supported catalog modelId when applicable.`,
      allowed,
    },
    { status: 400 }
  );
}
