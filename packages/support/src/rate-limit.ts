export type SupportRateLimiterOptions = {
  /** Sliding window length in ms. */
  windowMs: number;
  max: number;
};

/**
 * In-memory sliding-window limiter (per server instance). Same pattern as dashboard feedback API.
 */
export function createSupportRateLimiter(options: SupportRateLimiterOptions): {
  tryConsume(key: string): boolean;
} {
  const { windowMs, max } = options;
  const buckets = new Map<string, number[]>();

  return {
    tryConsume(key: string): boolean {
      const now = Date.now();
      const prev = buckets.get(key) ?? [];
      const active = prev.filter((ts) => now - ts < windowMs);
      if (active.length >= max) {
        buckets.set(key, active);
        return false;
      }
      active.push(now);
      buckets.set(key, active);
      return true;
    },
  };
}
