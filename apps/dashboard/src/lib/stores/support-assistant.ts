import { writable } from "svelte/store";

export const supportAssistantOpen = writable(false);

export function openSupportAssistant(): void {
  supportAssistantOpen.set(true);
}

export function closeSupportAssistant(): void {
  supportAssistantOpen.set(false);
}
