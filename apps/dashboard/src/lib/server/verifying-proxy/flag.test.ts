/**
 * Flag tests — the verifying-proxy remote gate is default OFF and fails closed.
 */
import { describe, expect, it } from "vitest";
import {
  isVerifyingProxyRemoteEnabled,
  VERIFYING_PROXY_REMOTE_ENV_VAR,
} from "./flag.js";

function env(value?: string): NodeJS.ProcessEnv {
  return value === undefined ? {} : { [VERIFYING_PROXY_REMOTE_ENV_VAR]: value };
}

describe("isVerifyingProxyRemoteEnabled", () => {
  it("is OFF by default (env unset)", () => {
    expect(isVerifyingProxyRemoteEnabled(env())).toBe(false);
  });

  it("is OFF for empty / falsey values (fail closed)", () => {
    for (const v of ["", "  ", "0", "false", "off", "no", "disabled", "FALSE"]) {
      expect(isVerifyingProxyRemoteEnabled(env(v))).toBe(false);
    }
  });

  it("is ON only for explicit truthy tokens", () => {
    for (const v of ["1", "true", "TRUE", "on", "enabled", " true "]) {
      expect(isVerifyingProxyRemoteEnabled(env(v))).toBe(true);
    }
  });

  it("exposes the env var name", () => {
    expect(VERIFYING_PROXY_REMOTE_ENV_VAR).toBe("RESTORMEL_VERIFYING_PROXY_REMOTE");
  });
});
