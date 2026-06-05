import { dev } from "$app/environment";

type PerfEntry = { route: string; span: string; ms: number };

const enabled = dev || process.env.DASHBOARD_PERF_LOG === "1";

/** Lightweight server timing — logs `{ route, span, ms }` when dev or DASHBOARD_PERF_LOG=1. */
export function perfSpan(route: string, span: string): () => void {
  if (!enabled) return () => {};
  const start = performance.now();
  return () => {
    const ms = Math.round(performance.now() - start);
    const entry: PerfEntry = { route, span, ms };
    console.info("[dashboard-perf]", JSON.stringify(entry));
  };
}
