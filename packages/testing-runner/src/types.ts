import type { KeysModelAdapterOptions } from "@restormel/testing-keys-adapter";
import type { PlaywrightTestingSessionOptions } from "@restormel/testing-browser-playwright";
import type { RestormelTestingConfig } from "@restormel/testing-config";
import type { RunRecord, RunTrigger, SuiteReportSlice, TraceEvent } from "@restormel/testing-core";
import type { TestingBrowserSession } from "@restormel/testing-browser-playwright";

export interface RunLocalSuiteOptions {
  /** Path to restormel-testing.yaml / .json */
  configPath: string;
  suiteId: string;
  /** Defaults to the suite’s configured environment. */
  environmentId?: string;
  /**
   * When set, replaces the resolved environment `base_url` (e.g. CI preview deploy URL).
   * Must be a safe http(s) URL with no embedded credentials.
   */
  targetUrlOverride?: string;
  goalIds?: string[];
  trigger?: RunTrigger;
  commitSha?: string;
  repository?: string;
  /** Directory for screenshots and future artefacts (created as needed). */
  artifactDir?: string;
  keysAdapterOptions?: KeysModelAdapterOptions;
  headless?: boolean;
  /**
   * Test / advanced: override browser session creation (e.g. mocks).
   * Default: Playwright Chromium via `createPlaywrightTestingSession`.
   */
  createBrowserSession?: (
    opts?: PlaywrightTestingSessionOptions,
  ) => Promise<TestingBrowserSession>;
}

export interface RunSuiteExecutionOptions {
  config: RestormelTestingConfig;
  suiteId: string;
  environmentId?: string;
  targetUrlOverride?: string;
  goalIds?: string[];
  trigger?: RunTrigger;
  commitSha?: string;
  repository?: string;
  artifactDir?: string;
  keysAdapterOptions?: KeysModelAdapterOptions;
  headless?: boolean;
  createBrowserSession?: (
    opts?: PlaywrightTestingSessionOptions,
  ) => Promise<TestingBrowserSession>;
  configFilePath?: string;
}

export interface RunSuiteResult {
  /** False when config could not be loaded or suite/environment invalid. */
  ok: boolean;
  run?: RunRecord;
  traces: TraceEvent[];
  warnings: string[];
  /** Human-readable failures (config path, validation, missing env). */
  errors: string[];
  /** Present when `ok` and the suite was resolved (for report generators). */
  suiteMeta?: SuiteReportSlice;
}
