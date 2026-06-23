import { describe, expect, it, afterEach } from "vitest";
import {
  MVP_MODULE_DEFAULTS,
  resolveModuleFlagsSync,
  isModuleEnabled,
  isGraphPreview,
  moduleFlagsToDashboardUiHidden,
  flagsFromPostHogPayload,
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

  it("MVP defaults keep the host-managed graph store off", () => {
    delete process.env.RESTORMEL_MODULE_FLAGS;
    const flags = resolveModuleFlagsSync();
    expect(flags.connectHostManagedGraphStore).toBe(false);
  });

  it("parses the new connect_host_managed_graph_store override", () => {
    process.env.RESTORMEL_MODULE_FLAGS = "connect,connect_host_managed_graph_store";
    const flags = resolveModuleFlagsSync();
    expect(flags.connect).toBe(true);
    expect(flags.connectHostManagedGraphStore).toBe(true);
    expect(isModuleEnabled(flags, "connectHostManagedGraphStore")).toBe(true);
  });

  // REC-ADR-008 back-compat: existing Coolify `RESTORMEL_MODULE_FLAGS` values use the
  // OLD `connect_neon_graph_store` token and must keep enabling the renamed flag.
  it("still parses the legacy connect_neon_graph_store env token (alias)", () => {
    process.env.RESTORMEL_MODULE_FLAGS = "connect,connect_neon_graph_store";
    const flags = resolveModuleFlagsSync();
    expect(flags.connectHostManagedGraphStore).toBe(true);
    expect(isModuleEnabled(flags, "connectHostManagedGraphStore")).toBe(true);
  });

  it("still parses the legacy kebab connect-neon-graph-store env token (alias)", () => {
    process.env.RESTORMEL_MODULE_FLAGS = "connect,connect-neon-graph-store";
    const flags = resolveModuleFlagsSync();
    expect(flags.connectHostManagedGraphStore).toBe(true);
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
    // REC-ADR-008: still OFF in prod until founder sign-off after the G4 gate.
    expect(MVP_MODULE_DEFAULTS.connectHostManagedGraphStore).toBe(false);
  });
});

describe("flagsFromPostHogPayload host-managed graph store (REC-ADR-008 dual-read)", () => {
  it("resolves true from the NEW PostHog key", () => {
    const flags = flagsFromPostHogPayload({
      "restormel-module-connect-host-managed-graph-store": true,
    });
    expect(flags.connectHostManagedGraphStore).toBe(true);
  });

  it("resolves true from the LEGACY `…-neon-graph-store` PostHog key (alias)", () => {
    // The EU PostHog project's flag is still keyed under the old name until migrated;
    // without dual-read an env with the rollout ON would silently revert to OFF.
    const flags = flagsFromPostHogPayload({
      "restormel-module-connect-neon-graph-store": true,
    });
    expect(flags.connectHostManagedGraphStore).toBe(true);
  });

  it("resolves false when neither key is present", () => {
    const flags = flagsFromPostHogPayload({});
    expect(flags.connectHostManagedGraphStore).toBe(false);
  });
});
