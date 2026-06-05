import type { UseCase } from "$lib/content/use-cases";

/** Lucide icon names used by use-case templates (must match UseCaseIcon.svelte branches). */
export type UseCaseIconName =
  | "Cpu"
  | "TrendingUp"
  | "Scale"
  | "Microscope"
  | "LifeBuoy"
  | "Sparkles"
  | "Music"
  | "Leaf"
  | "Landmark"
  | "Sprout"
  | "BookOpen"
  | "UtensilsCrossed"
  | "Castle";

const ICON_NAMES = new Set<string>([
  "Cpu",
  "TrendingUp",
  "Scale",
  "Microscope",
  "LifeBuoy",
  "Sparkles",
  "Music",
  "Leaf",
  "Landmark",
  "Sprout",
  "BookOpen",
  "UtensilsCrossed",
  "Castle",
]);

export function isUseCaseIconName(value: string): value is UseCaseIconName {
  return ICON_NAMES.has(value);
}

export function useCaseIconName(useCase: Pick<UseCase, "icon">): UseCaseIconName {
  return isUseCaseIconName(useCase.icon) ? useCase.icon : "Sparkles";
}
