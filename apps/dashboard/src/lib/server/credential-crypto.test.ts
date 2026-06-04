import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {} as Record<string, string | undefined>,
}));

vi.mock("$env/dynamic/private", () => ({
  env: mockEnv,
}));

import {
  credentialEncryptionMisconfigReason,
  encryptProviderSecret,
  isCredentialEncryptionConfigured,
} from "./credential-crypto";

/** 32 bytes, base64-encoded — valid shape for tests only. */
const TEST_KEY_B64 = Buffer.alloc(32, 1).toString("base64");

describe("credential-crypto", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockEnv)) delete mockEnv[key];
    delete process.env.RESTORMEL_CREDENTIALS_ENCRYPTION_KEY;
  });

  afterEach(() => {
    for (const key of Object.keys(mockEnv)) delete mockEnv[key];
    delete process.env.RESTORMEL_CREDENTIALS_ENCRYPTION_KEY;
  });

  it("reads RESTORMEL_CREDENTIALS_ENCRYPTION_KEY from $env/dynamic/private", () => {
    mockEnv.RESTORMEL_CREDENTIALS_ENCRYPTION_KEY = TEST_KEY_B64;
    expect(isCredentialEncryptionConfigured()).toBe(true);
    const enc = encryptProviderSecret("surreal-token");
    expect(enc.ok).toBe(true);
  });

  it("falls back to process.env when dynamic env is unset", () => {
    process.env.RESTORMEL_CREDENTIALS_ENCRYPTION_KEY = TEST_KEY_B64;
    expect(isCredentialEncryptionConfigured()).toBe(true);
  });

  it("reports misconfig when key is missing", () => {
    expect(isCredentialEncryptionConfigured()).toBe(false);
    expect(credentialEncryptionMisconfigReason()).toMatch(/not set/i);
  });

  it("reports misconfig when key is wrong length", () => {
    mockEnv.RESTORMEL_CREDENTIALS_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    expect(isCredentialEncryptionConfigured()).toBe(false);
    expect(credentialEncryptionMisconfigReason()).toMatch(/invalid/i);
  });
});
