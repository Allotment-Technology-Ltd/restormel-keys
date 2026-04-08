import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { keysAdapterOptionsFromProcessEnv } from "./env-from-process.js";

describe("keysAdapterOptionsFromProcessEnv", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.RESTORMEL_KEYS_API_BASE_URL;
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
