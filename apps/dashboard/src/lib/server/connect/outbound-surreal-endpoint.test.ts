import { afterEach, describe, expect, it } from "vitest";
import { validateOutboundSurrealEndpoint } from "./outbound-surreal-endpoint";

describe("validateOutboundSurrealEndpoint", () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origVercel = process.env.VERCEL_ENV;
  const origAllowPrivate = process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    process.env.VERCEL_ENV = origVercel;
    process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT = origAllowPrivate;
  });

  it("allows public HTTPS in production", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundSurrealEndpoint("https://instance.surreal.cloud")).toEqual({ ok: true });
  });

  it("rejects HTTP in production", () => {
    process.env.NODE_ENV = "production";
    const r = validateOutboundSurrealEndpoint("http://instance.surreal.cloud");
    expect(r.ok).toBe(false);
  });

  it("allows http://localhost in development", () => {
    process.env.NODE_ENV = "development";
    expect(validateOutboundSurrealEndpoint("http://localhost:8000")).toEqual({ ok: true });
  });

  it("blocks metadata hostnames", () => {
    process.env.NODE_ENV = "production";
    const r = validateOutboundSurrealEndpoint("https://metadata.google.internal");
    expect(r.ok).toBe(false);
  });

  it("blocks private IPv4 unless explicitly allowed", () => {
    process.env.NODE_ENV = "development";
    delete process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;
    const r = validateOutboundSurrealEndpoint("https://10.0.0.5");
    expect(r.ok).toBe(false);
  });
});
