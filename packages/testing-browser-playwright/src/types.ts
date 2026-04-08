import type { ArtifactRef, TraceEventKind } from "@restormel/testing-core";

/**
 * Narrow locators for deterministic tests — not a general Playwright selector DSL.
 */
export type TestingLocator =
  | { kind: "css"; selector: string }
  | {
      kind: "role";
      role: "button" | "link" | "textbox" | "heading" | "main" | "navigation" | "checkbox" | "radio";
      name?: string | RegExp;
    };

export interface BrowserConsoleLine {
  type: string;
  text: string;
}

export interface BrowserNetworkLine {
  url: string;
  method: string;
  status: number;
}

/**
 * Action-level trace lines for the runner to merge into {@link TraceEvent} (ids/runId/goalId/stepIndex added upstream).
 */
export interface BrowserSessionTraceEntry {
  timestamp: string;
  kind: TraceEventKind;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface PlaywrightTestingSessionOptions {
  headless?: boolean;
  /** Default navigation / action timeout (ms). */
  timeoutMs?: number;
  viewport?: { width: number; height: number };
  /** Path to Playwright `storageState` JSON (saved cookies/localStorage). */
  storageState?: string;
}

/**
 * Minimal browser surface for Restormel / Testing runners (single page, one context).
 */
export interface TestingBrowserSession {
  readonly page: import("playwright").Page;

  navigate(url: string, options?: { timeoutMs?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" }): Promise<void>;

  click(locator: TestingLocator, options?: { timeoutMs?: number }): Promise<void>;

  fill(locator: TestingLocator, value: string, options?: { timeoutMs?: number }): Promise<void>;

  waitForLoad(state?: "load" | "domcontentloaded" | "networkidle"): Promise<void>;

  waitForVisible(locator: TestingLocator, options?: { timeoutMs?: number }): Promise<void>;

  getVisibleText(locator: TestingLocator): Promise<string>;

  /**
   * Writes PNG to `path` (caller chooses artefact directory). Returns a core {@link ArtifactRef}.
   */
  screenshot(path: string): Promise<ArtifactRef>;

  /** Bounded snapshot (oldest dropped). */
  getConsoleSnapshot(): readonly BrowserConsoleLine[];

  /** Bounded snapshot of finished requests (URL, method, status). */
  getNetworkSnapshot(): readonly BrowserNetworkLine[];

  /** Drain accumulated trace entries since last drain (or since start if never drained). */
  drainTraceEntries(): BrowserSessionTraceEntry[];

  dispose(): Promise<void>;
}
