import { describe, expect, it } from "vitest";
import { createSupportRateLimiter } from "./rate-limit.js";

describe("createSupportRateLimiter", () => {
  it("allows up to max requests per window", () => {
    const lim = createSupportRateLimiter({ windowMs: 60_000, max: 3 });
    expect(lim.tryConsume("u1")).toBe(true);
    expect(lim.tryConsume("u1")).toBe(true);
    expect(lim.tryConsume("u1")).toBe(true);
    expect(lim.tryConsume("u1")).toBe(false);
  });

  it("tracks keys independently", () => {
    const lim = createSupportRateLimiter({ windowMs: 60_000, max: 1 });
    expect(lim.tryConsume("a")).toBe(true);
    expect(lim.tryConsume("b")).toBe(true);
  });
});
