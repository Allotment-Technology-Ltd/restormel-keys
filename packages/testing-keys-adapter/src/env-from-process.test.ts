import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  keysAdapterOptionsFromProcessEnv,
  keysHttpBearerFromProcessEnv,
} from "./env-from-process.js";

describe("keysAdapterOptionsFromProcessEnv", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.RESTORMEL_KEYS_API_BASE_URL;
    delete process.env.RESTORMEL_KEYS_BASE;
    delete process.env.RESTORMEL_KEYS_API_TOKEN_ENV;
    delete process.env.RESTORMEL_TESTING_OPENAI_FALLBACK;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("returns undefined when Keys URL and fallback are unset", () => {
    expect(keysAdapterOptionsFromProcessEnv()).toBeUndefined();
  });

  it("returns options when RESTORMEL_KEYS_API_BASE_URL is set", () => {
    process.env.RESTORMEL_KEYS_API_BASE_URL = "https://keys.example.test";
    const o = keysAdapterOptionsFromProcessEnv();
    expect(o?.keysApiBaseUrl).toBe("https://keys.example.test");
    expect(o?.keysApiTokenEnvVar).toBe("RESTORMEL_KEYS_API_TOKEN");
  });

  it("returns options when RESTORMEL_KEYS_BASE is set", () => {
    process.env.RESTORMEL_KEYS_BASE = "https://restormel.dev";
    const o = keysAdapterOptionsFromProcessEnv();
    expect(o?.keysApiBaseUrl).toBe("https://restormel.dev");
    expect(o?.keysApiTokenEnvVar).toBe("RESTORMEL_KEYS_API_TOKEN");
  });

  it("prefers RESTORMEL_KEYS_API_BASE_URL over RESTORMEL_KEYS_BASE when both set", () => {
    process.env.RESTORMEL_KEYS_API_BASE_URL = "https://api-priority.test";
    process.env.RESTORMEL_KEYS_BASE = "https://base.test";
    const o = keysAdapterOptionsFromProcessEnv();
    expect(o?.keysApiBaseUrl).toBe("https://api-priority.test");
  });

  it("honours RESTORMEL_KEYS_API_TOKEN_ENV for token var name", () => {
    process.env.RESTORMEL_KEYS_API_BASE_URL = "https://k.test";
    process.env.RESTORMEL_KEYS_API_TOKEN_ENV = "MY_KEYS_TOKEN";
    const o = keysAdapterOptionsFromProcessEnv();
    expect(o?.keysApiTokenEnvVar).toBe("MY_KEYS_TOKEN");
  });

  it("returns fallback-only options when RESTORMEL_TESTING_OPENAI_FALLBACK=1", () => {
    process.env.RESTORMEL_TESTING_OPENAI_FALLBACK = "1";
    const o = keysAdapterOptionsFromProcessEnv();
    expect(o?.openAiEnvFallback?.enabled).toBe(true);
    expect(o?.keysApiBaseUrl).toBeUndefined();
  });
});

describe("keysHttpBearerFromProcessEnv", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("returns custom env when RESTORMEL_KEYS_API_TOKEN_ENV target is set", () => {
    process.env.MY_TOKEN = "rk_custom";
    expect(keysHttpBearerFromProcessEnv("MY_TOKEN")).toBe("rk_custom");
  });

  it("falls back to RESTORMEL_KEYS_API_TOKEN when custom name unset", () => {
    process.env.RESTORMEL_KEYS_API_TOKEN = "rk_api";
    expect(keysHttpBearerFromProcessEnv("MY_EMPTY")).toBe("rk_api");
  });

  it("falls back to RESTORMEL_GATEWAY_KEY when API token unset", () => {
    process.env.RESTORMEL_GATEWAY_KEY = "rk_gw";
    expect(keysHttpBearerFromProcessEnv()).toBe("rk_gw");
  });

  it("falls back to RESTORMEL_SERVER_TOKEN when earlier vars unset", () => {
    process.env.RESTORMEL_SERVER_TOKEN = "rk_srv";
    expect(keysHttpBearerFromProcessEnv()).toBe("rk_srv");
  });

  it("prefers custom named var over RESTORMEL_KEYS_API_TOKEN when both set", () => {
    process.env.CUSTOM = "rk_a";
    process.env.RESTORMEL_KEYS_API_TOKEN = "rk_b";
    expect(keysHttpBearerFromProcessEnv("CUSTOM")).toBe("rk_a");
  });
});
