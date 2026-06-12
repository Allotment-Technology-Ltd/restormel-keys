<script lang="ts">
  import type { ConnectEvalVerdictEntry } from "@restormel/contracts";

  /**
   * R3 — the trust-cap sparkline (NS §3.3: "▁▃▅▆▆▇ 20-verdict sparkline").
   *
   * Render-only: it consumes the already-streamed `qualityHistory` (no new query —
   * Pivot 1.8) and plots each verdict's `trust_score` oldest→newest left-to-right.
   * `ConnectTrustScorecard` has no sparkline, so the cap mounts this beside it.
   *
   * State honesty (R3-S3 / X7): when no verdict carries a trust_score there is no
   * series to draw — the component renders an explicit absent-state ("no history
   * yet"), never a flat fabricated line.
   *
   * Accessibility (R3-A2): the SVG is `role="img"` with an `aria-label` text
   * alternative naming the trend; the same summary is also rendered as visible
   * mono text so the trend is never colour-or-shape-only.
   *
   * X4 / NS §2.4: the caption links to `runsHref` (the run/verdict history) so the
   * trend status is never an orphan — it always points at the series that produced it.
   */

  /** Newest-first verdict entries (server order: evaluated_at DESC). */
  export let history: ConnectEvalVerdictEntry[] = [];
  /** How many most-recent verdicts to plot. */
  export let limit = 20;
  /** Href for the verdict/run history receipt. X4: caption must link here. */
  export let runsHref: string = "";

  // Oldest→newest, most-recent `limit` entries, keeping only scored verdicts.
  $: scores = history
    .filter((e) => typeof e.verdict.trust_score === "number")
    .slice(0, limit)
    .map((e) => e.verdict.trust_score as number)
    .reverse();

  $: latest = scores.length > 0 ? scores[scores.length - 1] : null;
  $: first = scores.length > 0 ? scores[0] : null;
  $: delta = latest != null && first != null ? Math.round((latest - first) * 10) / 10 : null;

  // Geometry — a compact 20-point polyline in a fixed viewBox.
  const W = 120;
  const H = 28;
  const PAD = 2;

  $: points = (() => {
    if (scores.length < 2) return "";
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;
    const stepX = (W - PAD * 2) / (scores.length - 1);
    return scores
      .map((s, i) => {
        const x = PAD + i * stepX;
        const y = PAD + (H - PAD * 2) * (1 - (s - min) / range);
        return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
      })
      .join(" ");
  })();

  $: trendWord = delta == null ? "" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  $: ariaLabel =
    scores.length < 2
      ? "Trust history: not enough verdicts to chart a trend yet"
      : `Trust history over the last ${scores.length} verdicts: trend ${trendWord}, ${
          delta != null && delta > 0 ? "+" : ""
        }${delta} points, latest ${latest}`;
</script>

<div class="sparkline" aria-label="Trust history">
  {#if scores.length < 2}
    <span class="sparkline-absent">no history yet</span>
  {:else}
    <svg
      class="sparkline-svg"
      viewBox="0 0 {W} {H}"
      width={W}
      height={H}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <polyline
        class="sparkline-line"
        points={points}
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>
    <!-- X4 / NS §2.4: caption links to the verdict history that produced this trend -->
    {#if runsHref}
      <a class="sparkline-caption sparkline-caption--link brut-focus" href={runsHref} aria-label="View verdict history: {scores.length} verdicts, {delta != null && delta > 0 ? '+' : ''}{delta} pts trend">
        {scores.length} verdicts · {delta != null && delta > 0 ? "+" : ""}{delta} pts →
      </a>
    {:else}
      <span class="sparkline-caption" aria-hidden="true">
        {scores.length} verdicts · {delta != null && delta > 0 ? "+" : ""}{delta} pts
      </span>
    {/if}
  {/if}
</div>

<style>
  .sparkline {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-ink);
  }
  .sparkline-svg {
    display: block;
    height: 28px;
    width: 120px;
  }
  .sparkline-line {
    color: var(--color-ink);
  }
  .sparkline-caption {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink);
    white-space: nowrap;
  }
  .sparkline-caption--link {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .sparkline-absent {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink-muted);
    white-space: nowrap;
  }
</style>
