/**
 * Walkthrough progress: persisted checklist state per phase.
 * Key: restormel-walkthrough-{phaseSlug} → JSON object { stepId: boolean }
 * Used by WalkthroughChecklist and WalkthroughStep.
 */

import { writable } from "svelte/store";

const PREFIX = "restormel-walkthrough-";

function storageKey(phaseSlug: string): string {
  return `${PREFIX}${phaseSlug}`;
}

export function getPhaseProgress(phaseSlug: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(phaseSlug));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => typeof v === "boolean") as [string, boolean][]
    );
  } catch {
    return {};
  }
}

const progressStores = new Map<string, ReturnType<typeof writable<Record<string, boolean>>>>();

function getStore(phaseSlug: string) {
  let s = progressStores.get(phaseSlug);
  if (!s) {
    s = writable(getPhaseProgress(phaseSlug));
    progressStores.set(phaseSlug, s);
  }
  return s;
}

export function setStepComplete(phaseSlug: string, stepId: string, complete: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const current = getPhaseProgress(phaseSlug);
    const next = { ...current, [stepId]: complete };
    localStorage.setItem(storageKey(phaseSlug), JSON.stringify(next));
    getStore(phaseSlug).set(next);
  } catch {
    // ignore
  }
}

export function isStepComplete(phaseSlug: string, stepId: string): boolean {
  return getPhaseProgress(phaseSlug)[stepId] === true;
}

export function getProgressStore(phaseSlug: string) {
  return getStore(phaseSlug);
}

/** Call on client mount to sync store from localStorage (e.g. after hydration). */
export function syncProgressFromStorage(phaseSlug: string): void {
  if (typeof window === "undefined") return;
  getStore(phaseSlug).set(getPhaseProgress(phaseSlug));
}
