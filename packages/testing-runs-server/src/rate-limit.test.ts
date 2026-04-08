import { describe, expect, it } from "vitest";
import { MinuteWindowRateLimiter } from "./rate-limit.js";

describe("MinuteWindowRateLimiter", () => {
  it("allows when max is 0", () => {
    const l = new MinuteWindowRateLimiter(0);
    expect(l.tryConsume("a")).toBe(true);
    expect(l.tryConsume("a")).toBe(true);
  });

  it("enforces per-key count in same window", () => {
    const l = new MinuteWindowRateLimiter(2);
    expect(l.tryConsume("ip1")).toBe(true);
    expect(l.tryConsume("ip1")).toBe(true);
    expect(l.tryConsume("ip1")).toBe(false);
    expect(l.tryConsume("ip2")).toBe(true);
  });
});
