/**
 * Provider keys shown in route step UI and used to filter catalog models per step.
 * Must stay aligned with {@link ROUTE_STEP_ALLOWED_STORAGE_PROVIDERS}.
 */
import { ROUTE_STEP_ALLOWED_STORAGE_PROVIDERS } from "$lib/route-step-allowed-providers";

export const ROUTE_STEP_PROVIDER_OPTIONS = [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "together",
  "voyage",
  "openrouter",
  "vercel",
  "portkey",
  "aizolo",
] as const;

export type RouteStepProviderOption = (typeof ROUTE_STEP_PROVIDER_OPTIONS)[number];

const allowed = ROUTE_STEP_ALLOWED_STORAGE_PROVIDERS;

for (const id of ROUTE_STEP_PROVIDER_OPTIONS) {
  if (!allowed.has(id)) {
    throw new Error(`route-step-providers: ${id} is not in ROUTE_STEP_ALLOWED_STORAGE_PROVIDERS`);
  }
}

/** Human-readable labels for Connections UI provider cards. */
export const DIRECT_PROVIDER_CONNECT_CARDS: { value: string; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "mistral", label: "Mistral" },
  { value: "together", label: "Together AI" },
  { value: "voyage", label: "Voyage AI" },
  { value: "aizolo", label: "AiZolo" },
];
