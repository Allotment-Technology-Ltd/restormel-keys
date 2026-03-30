import { writable } from "svelte/store";

export const feedbackWidgetOpen = writable(false);

export function openFeedbackWidget(): void {
  feedbackWidgetOpen.set(true);
}

export function closeFeedbackWidget(): void {
  feedbackWidgetOpen.set(false);
}
