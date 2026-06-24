import { writable } from "svelte/store";

export type UserMode = "new_project" | "existing_stack" | "byok_saas" | "cli_agent" | "ops";
export type UserStackChoice =
  | "openrouter"
  | "vercel_ai_gateway"
  | "portkey"
  | "direct_env_secrets"
  | "not_sure_yet";

export const USER_MODE_STORAGE_KEY = "restormel_user_mode";
export const USER_STACK_CHOICE_STORAGE_KEY = "restormel_stack_choice";

export type UserModeOption = {
  value: UserMode;
  label: string;
  description: string;
  icon: string;
};

export const USER_MODE_OPTIONS: UserModeOption[] = [
  {
    value: "new_project",
    label: "Starting a new project",
    description: "Get routing and your first resolve call in 15-20 minutes",
    icon: "🚀",
  },
  {
    value: "existing_stack",
    label: "Adding control to my stack",
    description: "Slot Restormel above OpenRouter, Vercel AI, or Portkey",
    icon: "🧩",
  },
  {
    value: "byok_saas",
    label: "Adding BYOK to my SaaS",
    description: "Embed KeyManager and model choice for your end users",
    icon: "🔐",
  },
  {
    value: "cli_agent",
    label: "Working in CLI / agent / IDE",
    description: "MCP, CLI, Dispatch, and CI/CD workflows",
    icon: "🛠️",
  },
  {
    value: "ops",
    label: "Running platform operations",
    description: "Monitor usage, govern access, rotate keys, check health",
    icon: "🧭",
  },
];

function isUserMode(value: unknown): value is UserMode {
  return (
    value === "new_project" ||
    value === "existing_stack" ||
    value === "byok_saas" ||
    value === "cli_agent" ||
    value === "ops"
  );
}

function isUserStackChoice(value: unknown): value is UserStackChoice {
  return (
    value === "openrouter" ||
    value === "vercel_ai_gateway" ||
    value === "portkey" ||
    value === "direct_env_secrets" ||
    value === "not_sure_yet"
  );
}

function readStoredMode(): UserMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_MODE_STORAGE_KEY);
    return isUserMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

function readStoredStackChoice(): UserStackChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_STACK_CHOICE_STORAGE_KEY);
    return isUserStackChoice(raw) ? raw : null;
  } catch {
    return null;
  }
}

const internalUserMode = writable<UserMode | null>(readStoredMode());
const internalUserStackChoice = writable<UserStackChoice | null>(readStoredStackChoice());

internalUserMode.subscribe((value) => {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      localStorage.removeItem(USER_MODE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(USER_MODE_STORAGE_KEY, value);
  } catch {
    // ignore storage errors
  }
});

internalUserStackChoice.subscribe((value) => {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      localStorage.removeItem(USER_STACK_CHOICE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(USER_STACK_CHOICE_STORAGE_KEY, value);
  } catch {
    // ignore storage errors
  }
});

export const userMode = {
  subscribe: internalUserMode.subscribe,
};

export const userStackChoice = {
  subscribe: internalUserStackChoice.subscribe,
};

export function setUserMode(mode: UserMode): void {
  internalUserMode.set(mode);
}

export function clearUserMode(): void {
  internalUserMode.set(null);
}

export function setUserStackChoice(choice: UserStackChoice): void {
  internalUserStackChoice.set(choice);
}

export function clearUserStackChoice(): void {
  internalUserStackChoice.set(null);
}

export function syncUserModeFromStorage(): void {
  internalUserMode.set(readStoredMode());
}

export function syncUserStackChoiceFromStorage(): void {
  internalUserStackChoice.set(readStoredStackChoice());
}
