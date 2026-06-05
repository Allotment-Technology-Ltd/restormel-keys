import type { UseCaseColor } from "$lib/content/use-cases";

/** Scoped CSS custom properties per template accent (maps to brutal / rm tokens). */
export const USE_CASE_COLOR_VARS: Record<
  UseCaseColor,
  { accent: string; accentMuted: string; iconBg: string }
> = {
  amber: {
    accent: "var(--brut-amber, #e8a317)",
    accentMuted: "color-mix(in srgb, var(--brut-amber, #e8a317) 18%, transparent)",
    iconBg: "color-mix(in srgb, var(--brut-amber, #e8a317) 22%, var(--brut-white))",
  },
  teal: {
    accent: "var(--brut-teal, #0d9488)",
    accentMuted: "color-mix(in srgb, var(--brut-teal, #0d9488) 18%, transparent)",
    iconBg: "color-mix(in srgb, var(--brut-teal, #0d9488) 22%, var(--brut-white))",
  },
  coral: {
    accent: "var(--brut-coral, #e85d4c)",
    accentMuted: "color-mix(in srgb, var(--brut-coral, #e85d4c) 18%, transparent)",
    iconBg: "color-mix(in srgb, var(--brut-coral, #e85d4c) 22%, var(--brut-white))",
  },
  blue: {
    accent: "var(--brut-blue)",
    accentMuted: "color-mix(in srgb, var(--brut-blue) 18%, transparent)",
    iconBg: "color-mix(in srgb, var(--brut-blue) 22%, var(--brut-white))",
  },
  purple: {
    accent: "var(--brut-purple, #7c3aed)",
    accentMuted: "color-mix(in srgb, var(--brut-purple, #7c3aed) 18%, transparent)",
    iconBg: "color-mix(in srgb, var(--brut-purple, #7c3aed) 22%, var(--brut-white))",
  },
  green: {
    accent: "var(--brut-green, #16a34a)",
    accentMuted: "color-mix(in srgb, var(--brut-green, #16a34a) 18%, transparent)",
    iconBg: "color-mix(in srgb, var(--brut-green, #16a34a) 22%, var(--brut-white))",
  },
};
