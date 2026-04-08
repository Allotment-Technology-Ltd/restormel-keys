import { describe, expect, it } from "vitest";
import type { EnvironmentProfile } from "@restormel/testing-core";
import { resolveStorageStatePath } from "./storage-state.js";

describe("resolveStorageStatePath", () => {
  const cfg = "/app/repo/restormel-testing.yaml";

  it("returns undefined when auth_mode is not storage_state", () => {
    const p: EnvironmentProfile = {
      id: "local",
      baseUrl: "https://a.test",
      authMode: "none",
      authRef: "env:FOO",
    };
    expect(resolveStorageStatePath(p, cfg)).toBeUndefined();
  });

  it("reads path from env:VAR", () => {
    process.env.RESTORMEL_TEST_STORAGE = "/tmp/state.json";
    const p: EnvironmentProfile = {
      id: "local",
      baseUrl: "https://a.test",
      authMode: "storage_state",
      authRef: "env:RESTORMEL_TEST_STORAGE",
    };
    expect(resolveStorageStatePath(p, cfg)).toBe("/tmp/state.json");
    delete process.env.RESTORMEL_TEST_STORAGE;
  });

  it("resolves relative path from config directory", () => {
    const p: EnvironmentProfile = {
      id: "local",
      baseUrl: "https://a.test",
      authMode: "storage_state",
      authRef: "fixtures/auth.json",
    };
    expect(resolveStorageStatePath(p, cfg)).toBe("/app/repo/fixtures/auth.json");
  });
});
