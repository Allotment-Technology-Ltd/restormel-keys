/**
 * Cross-component signal: count of claims awaiting human review.
 *
 * Written by ConnectGraphExplorer when graph stats are available.
 * Read by the dashboard sidebar to badge the Claims item (W2.1 badge, relocated in R2).
 *
 * The store is purely client-side — it is undefined on the server (the badge
 * only renders after hydration, which is fine since the tab is not an SSR-only
 * concern).
 */
import { writable } from "svelte/store";

/**
 * Number of claims currently awaiting human review, or `null` when unknown
 * (e.g. stats not yet loaded, or no graph present).
 */
export const connectReviewCount = writable<number | null>(null);
