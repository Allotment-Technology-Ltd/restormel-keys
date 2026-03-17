/**
 * Walkthrough phase list for docs nav. Canonical order and slugs; used by walkthrough index and phase pages for prev/next.
 */
export const WALKTHROUGH_PHASES = [
  { slug: "phase-0-inventory", title: "Phase 0 — Inventory your routing", step: 1 },
  { slug: "phase-1-install", title: "Phase 1 — Install and configure", step: 2 },
  { slug: "phase-2-resolve", title: "Phase 2 — Resolve your first model", step: 3 },
  { slug: "phase-3-routes", title: "Phase 3 — Add routes and fallbacks", step: 4 },
  { slug: "phase-4-policies", title: "Phase 4 — Apply policies", step: 5 },
  { slug: "phase-5-ui", title: "Phase 5 — Embed the UI", step: 6 },
  { slug: "phase-6-golive", title: "Phase 6 — Go live", step: 7 },
  { slug: "migration-paths", title: "Migration paths", step: 8 },
  { slug: "verification-strategy", title: "Verification strategy", step: 9 },
] as const;

const BASE = "/keys/docs/walkthrough";

export function getWalkthroughPrevNext(currentSlug: string): { prev: { href: string; label: string } | null; next: { href: string; label: string } | null; stepOf: string } {
  const idx = WALKTHROUGH_PHASES.findIndex((p) => p.slug === currentSlug);
  const total = WALKTHROUGH_PHASES.length;
  const stepOf = `Step ${idx + 1} of ${total}`;
  const prev =
    idx <= 0
      ? null
      : { href: `${BASE}/${WALKTHROUGH_PHASES[idx - 1].slug}`, label: WALKTHROUGH_PHASES[idx - 1].title };
  const next =
    idx < 0 || idx >= total - 1
      ? null
      : { href: `${BASE}/${WALKTHROUGH_PHASES[idx + 1].slug}`, label: WALKTHROUGH_PHASES[idx + 1].title };
  return { prev, next, stepOf };
}
