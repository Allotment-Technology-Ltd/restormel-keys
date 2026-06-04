import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  MVP_MODULE_DEFAULTS,
  resolveModuleFlagsSync,
  isModuleEnabled,
  isGraphPreview,
  moduleFlagsToDashboardUiHidden,
} from "./module-flags";

describe("module-flags env override", () => {
  const original = process.env.RESTORMEL_MODULE_FLAGS;

  afterEach(() => {
    if (original === undefined) delete process.env.RESTORMEL_MODULE_FLAGS;
    else process.env.RESTORMEL_MODULE_FLAGS = original;
  });

  it("returns MVP defaults when env unset", () => {
    delete process.env.RESTORMEL_MODULE_FLAGS;
    const flags = resolveModuleFlagsSync();
    expect(flags.connect).toBe(true);
    expect(flags.testing).toBe(false);
    expect(flags.graph).toBe("disabled");
    expect(flags.fromEnvOverride).toBe(false);
  });

  it("parses connect-only override", () => {
    process.env.RESTORMEL_MODULE_FLAGS = "connect";
    const flags = resolveModuleFlagsSync();
    expect(flags.connect).toBe(true);
    expect(flags.testing).toBe(false);
    expect(flags.fromEnvOverride).toBe(true);
  });

  it("parses dogfood override with graph preview", () => {
    process.env.RESTORMEL_MODULE_FLAGS = "connect,testing,graph:preview,guardrails,environments";
    const flags = resolveModuleFlagsSync();
    expect(flags.testing).toBe(true);
    expect(flags.graph).toBe("preview");
    expect(flags.guardrails).toBe(true);
    expect(flags.environments).toBe(true);
    expect(isGraphPreview(flags)).toBe(true);
  });

  it("isModuleEnabled respects flags", () => {
    process.env.RESTORMEL_MODULE_FLAGS = "testing,gateway_providers";
    const flags = resolveModuleFlagsSync();
    expect(isModuleEnabled(flags, "testing")).toBe(true);
    expect(isModuleEnabled(flags, "gatewayProviders")).toBe(true);
    expect(isModuleEnabled(flags, "guardrails")).toBe(false);
  });

  it("MVP defaults keep host Neon graph store off", () => {
    delete process.env.RESTORMEL_MODULE_FLAGS;
    const flags = resolveModuleFlagsSync();
    expect(flags.connectNeonGraphStore).toBe(false);
  });

  it("parses connect_neon_graph_store override", () => {
    process.env.RESTORMEL_MODULE_FLAGS = "connect,connect_neon_graph_store";
    const flags = resolveModuleFlagsSync();
    expect(flags.connect).toBe(true);
    expect(flags.connectNeonGraphStore).toBe(true);
    expect(isModuleEnabled(flags, "connectNeonGraphStore")).toBe(true);
  });

  it("parses monitor override", () => {
    process.env.RESTORMEL_MODULE_FLAGS = "connect,monitor";
    const flags = resolveModuleFlagsSync();
    expect(flags.monitor).toBe(true);
    expect(isModuleEnabled(flags, "monitor")).toBe(true);
  });

  it("hides monitor UI sections when monitor off", () => {
    delete process.env.RESTORMEL_MODULE_FLAGS;
    const hidden = moduleFlagsToDashboardUiHidden(resolveModuleFlagsSync());
    expect(hidden).toContain("analytics");
    expect(hidden).toContain("logs");
    expect(hidden).toContain("healthcheck");
  });
});

describe("MVP_MODULE_DEFAULTS", () => {
  it("matches PostHog MVP rollouts", () => {
    expect(MVP_MODULE_DEFAULTS.connect).toBe(true);
    expect(MVP_MODULE_DEFAULTS.testing).toBe(false);
    expect(MVP_MODULE_DEFAULTS.gatewayProviders).toBe(false);
    expect(MVP_MODULE_DEFAULTS.environments).toBe(false);
    expect(MVP_MODULE_DEFAULTS.connectNeonGraphStore).toBe(false);
  });
});
