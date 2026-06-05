/**
 * Client-only Lucide map — import only from onMount / dynamic import paths.
 */
import type { Component } from "svelte";
import {
  BookOpen,
  Castle,
  Cpu,
  Landmark,
  Leaf,
  LifeBuoy,
  Microscope,
  Music,
  Scale,
  Sparkles,
  Sprout,
  TrendingUp,
  UtensilsCrossed,
} from "@lucide/svelte";
import type { UseCaseIconName } from "$lib/content/use-case-icons";

const ICON_MAP: Record<UseCaseIconName, Component> = {
  Cpu,
  TrendingUp,
  Scale,
  Microscope,
  LifeBuoy,
  Sparkles,
  Music,
  Leaf,
  Landmark,
  Sprout,
  BookOpen,
  UtensilsCrossed,
  Castle,
};

export function lucideUseCaseIcon(name: UseCaseIconName): Component {
  return ICON_MAP[name] ?? Sparkles;
}
