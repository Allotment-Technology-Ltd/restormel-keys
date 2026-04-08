/**
 * @restormel/testing-browser-playwright — Playwright-backed browser adapter for Restormel / Testing (MVP).
 */
export const testingBrowserPlaywrightPackage = "@restormel/testing-browser-playwright" as const;

export { createPlaywrightTestingSession, PlaywrightTestingSession } from "./playwright-session.js";
export { resolveLocator } from "./locator.js";
export { browserTracesToCoreEvents } from "./trace-bridge.js";
export type {
  BrowserConsoleLine,
  BrowserNetworkLine,
  BrowserSessionTraceEntry,
  PlaywrightTestingSessionOptions,
  TestingBrowserSession,
  TestingLocator,
} from "./types.js";
