import { writable } from "svelte/store";

export const ACTIVE_PROJECT_SESSION_KEY = "restormel_active_project";

export type ActiveProjectSelection = {
  projectId: string;
  /** Omitted when environments module is off (project-only scope). */
  environmentId?: string;
};

function isSelection(value: unknown): value is ActiveProjectSelection {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.projectId === "string" &&
    (v.environmentId === undefined || typeof v.environmentId === "string")
  );
}

function readStoredSelection(): ActiveProjectSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ACTIVE_PROJECT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isSelection(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const internalStore = writable<ActiveProjectSelection | null>(readStoredSelection());

internalStore.subscribe((value) => {
  if (typeof window === "undefined") return;
  try {
    if (!value) {
      sessionStorage.removeItem(ACTIVE_PROJECT_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(ACTIVE_PROJECT_SESSION_KEY, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
});

export const activeProject = {
  subscribe: internalStore.subscribe,
};

export function setActiveProject(selection: ActiveProjectSelection): void {
  internalStore.set(selection);
}

export function clearActiveProject(): void {
  internalStore.set(null);
}

export function syncActiveProjectFromSession(): void {
  internalStore.set(readStoredSelection());
}
