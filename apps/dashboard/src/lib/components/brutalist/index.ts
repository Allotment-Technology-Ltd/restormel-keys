/**
 * Canonical neo-brutalist primitives (Restormel design system v3).
 *
 * RES-113 / Q22 resolution — `.brutal-input` / `.brutal-card` are NOT global utility
 * classes: they are scoped INSIDE these components, so raw class names get no styling.
 * The handoff (04_TOKENS.md / 06_SVELTE.md) is therefore standardised on the COMPONENTS,
 * not a promoted utilities sheet (the lower-churn, zero-regression option). Import the
 * primitives from here; do not hand-write `.brutal-*` markup in onboarding surfaces.
 */
export { default as BrutalBadge } from "./BrutalBadge.svelte";
export { default as BrutalBentoCell } from "./BrutalBentoCell.svelte";
export { default as BrutalBentoGrid } from "./BrutalBentoGrid.svelte";
export { default as BrutalButton } from "./BrutalButton.svelte";
export { default as BrutalCard } from "./BrutalCard.svelte";
export { default as BrutalErrorBanner } from "./BrutalErrorBanner.svelte";
export { default as BrutalInput } from "./BrutalInput.svelte";
export { default as BrutalLoadingState } from "./BrutalLoadingState.svelte";
export { default as BrutalPageHeader } from "./BrutalPageHeader.svelte";
export { default as StateChip } from "./StateChip.svelte";
export type { StateChipState } from "./StateChip.svelte";
