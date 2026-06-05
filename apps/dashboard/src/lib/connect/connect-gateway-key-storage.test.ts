import { describe, expect, it } from "vitest";
import { isGatewayKeyShape } from "./connect-gateway-key-storage";

const SAMPLE_KEY = "rk_abcdefghijklmnopqrstuvwx";

describe("connect-gateway-key-storage", () => {
  it("accepts rk_ gateway key shape", () => {
    expect(isGatewayKeyShape(SAMPLE_KEY)).toBe(true);
    expect(isGatewayKeyShape("sk-foo")).toBe(false);
    expect(isGatewayKeyShape("rk_short")).toBe(false);
  });
});
