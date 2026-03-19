/**
 * Integrations walkthrough phase list. Same principles as Keys walkthrough: canonical order, prev/next, step-of.
 */
export const INTEGRATIONS_WALKTHROUGH_PHASES = [
  { slug: "phase-0-overview", title: "Phase 0 — What is Restormel Integrations?", step: 1 },
  { slug: "phase-1-choose-workflow", title: "Phase 1 — Choose your workflow", step: 2 },
  { slug: "phase-2-cli", title: "Phase 2 — CLI", step: 3 },
  { slug: "phase-3-mcp", title: "Phase 3 — MCP", step: 4 },
  { slug: "phase-4-aaif", title: "Phase 4 — AAIF", step: 5 },
  { slug: "phase-5-dashboard-docs", title: "Phase 5 — Dashboard & docs", step: 6 },
  { slug: "phase-6-verify", title: "Phase 6 — Verify and go live", step: 7 },
  { slug: "prompt-index", title: "Prompt index", step: 8 },
] as const;

const BASE = "/keys/docs/integrations-walkthrough";

export function getIntegrationsWalkthroughPrevNext(
  currentSlug: string
): { prev: { href: string; label: string } | null; next: { href: string; label: string } | null; stepOf: string } {
  const idx = INTEGRATIONS_WALKTHROUGH_PHASES.findIndex((p) => p.slug === currentSlug);
  const total = INTEGRATIONS_WALKTHROUGH_PHASES.length;
  const stepOf = `Step ${idx + 1} of ${total}`;
  const prev =
    idx <= 0
      ? null
      : { href: `${BASE}/${INTEGRATIONS_WALKTHROUGH_PHASES[idx - 1].slug}`, label: INTEGRATIONS_WALKTHROUGH_PHASES[idx - 1].title };
  const next =
    idx < 0 || idx >= total - 1
      ? null
      : { href: `${BASE}/${INTEGRATIONS_WALKTHROUGH_PHASES[idx + 1].slug}`, label: INTEGRATIONS_WALKTHROUGH_PHASES[idx + 1].title };
  return { prev, next, stepOf };
}
