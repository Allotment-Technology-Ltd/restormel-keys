/**
 * Fixed one-minute windows per client key (e.g. IP). Not distributed — use a proxy limiter
 * for multi-instance deployments, or keep **RESTORMEL_RUNS_RATE_LIMIT_RPM=0** there.
 */
export class MinuteWindowRateLimiter {
  private readonly buckets = new Map<string, { windowStart: number; count: number }>();
  private readonly maxPerWindow: number;
  /** Cap map size to avoid unbounded memory if many unique clients. */
  private readonly maxKeys: number;

  constructor(maxPerMinute: number, maxKeys = 10_000) {
    this.maxPerWindow = maxPerMinute;
    this.maxKeys = maxKeys;
  }

  tryConsume(clientKey: string): boolean {
    if (this.maxPerWindow <= 0) return true;
    const now = Date.now();
    const windowStart = Math.floor(now / 60_000) * 60_000;
    const prev = this.buckets.get(clientKey);
    if (prev === undefined || prev.windowStart !== windowStart) {
      if (this.buckets.size >= this.maxKeys) {
        this.pruneStale(windowStart);
      }
      this.buckets.set(clientKey, { windowStart, count: 1 });
      return true;
    }
    if (prev.count >= this.maxPerWindow) return false;
    prev.count += 1;
    return true;
  }

  private pruneStale(currentWindow: number): void {
    for (const [k, v] of this.buckets) {
      if (v.windowStart < currentWindow) this.buckets.delete(k);
    }
    if (this.buckets.size >= this.maxKeys) {
      this.buckets.clear();
    }
  }
}
