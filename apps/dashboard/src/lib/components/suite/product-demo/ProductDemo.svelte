<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy, onMount } from "svelte";
  import { agentLog } from "$lib/debug/agent-log";
  import "$lib/styles/product-demo.css";
  import "$lib/components/connect/pipeline/connect-pipeline.css";
  import ProductDemoStepPanels from "./ProductDemoStepPanels.svelte";
  import { DEMO_STEPS, DEMO_STEP_MS, INGEST_LOG_LINES } from "./product-demo-data";

  let stepIndex = 0;
  /** Marketing demo: start paused until mounted to avoid SSR/hydration racing setInterval. */
  let paused = true;
  let timerKey = 0;
  let visibleLogLines: string[] = [];

  let advanceInterval: ReturnType<typeof setInterval> | undefined;
  let logInterval: ReturnType<typeof setInterval> | undefined;

  $: currentStep = DEMO_STEPS[stepIndex];
  $: stepDurationSec = `${DEMO_STEP_MS / 1000}s`;
  $: mobileStepLabel = `${stepIndex + 1} / ${DEMO_STEPS.length}`;

  function clearAdvanceInterval() {
    if (advanceInterval !== undefined) {
      clearInterval(advanceInterval);
      advanceInterval = undefined;
    }
  }

  function clearLogInterval() {
    if (logInterval !== undefined) {
      clearInterval(logInterval);
      logInterval = undefined;
    }
  }

  function bumpTimer() {
    timerKey += 1;
  }

  function startLogAnimation() {
    clearLogInterval();
    visibleLogLines = [];
    if (DEMO_STEPS[stepIndex]?.id !== "ingest") return;

    let idx = 1;
    visibleLogLines = [INGEST_LOG_LINES[0]];

    logInterval = setInterval(() => {
      if (idx >= INGEST_LOG_LINES.length) {
        clearLogInterval();
        return;
      }
      visibleLogLines = [...visibleLogLines, INGEST_LOG_LINES[idx]];
      idx += 1;
    }, 1000);
  }

  function restartAutoAdvance() {
    clearAdvanceInterval();
    if (paused) return;
    advanceInterval = setInterval(() => {
      if (paused) return;
      stepIndex = stepIndex >= DEMO_STEPS.length - 1 ? 0 : stepIndex + 1;
      bumpTimer();
    }, DEMO_STEP_MS);
  }

  function goTo(index: number) {
    const next = Math.max(0, Math.min(DEMO_STEPS.length - 1, index));
    if (next === stepIndex) return;
    stepIndex = next;
    bumpTimer();
  }

  function nextStep() {
    goTo(stepIndex + 1);
  }

  function prevStep() {
    goTo(stepIndex - 1);
  }

  function onFrameEnter() {
    paused = true;
    clearAdvanceInterval();
  }

  function onFrameLeave() {
    paused = false;
    bumpTimer();
    restartAutoAdvance();
  }

  $: if (browser) {
    stepIndex;
    startLogAnimation();
  }
  $: if (browser) {
    // #region agent log
    agentLog(
      "ProductDemo.svelte:stepIndex",
      "demo step changed",
      { stepIndex, stepId: DEMO_STEPS[stepIndex]?.id },
      "H7",
      "post-fix"
    );
    // #endregion
  }

  onMount(() => {
    // #region agent log
    agentLog("ProductDemo.svelte:onMount", "demo mounted (auto-advance starts after paint)", { stepIndex }, "H7", "post-fix");
    // #endregion
    paused = false;
    restartAutoAdvance();
  });

  onDestroy(() => {
    clearAdvanceInterval();
    clearLogInterval();
  });

  // TODO: Export resting-state frames (all 7 steps) as GIF/WebM for Open Graph and docs screen recordings.
</script>

<section class="product-demo-section" id="first-run-demo" aria-labelledby="product-demo-heading">
  <div class="suite-section-inner product-demo connect-pipeline">
    <p class="product-demo-eyebrow">Restormel — First run</p>
    <h2 id="product-demo-heading" class="product-demo-title">From connections to agent-ready knowledge</h2>

    <p class="product-demo-step-mobile" aria-live="polite">
      {mobileStepLabel} · {currentStep.shortLabel}
    </p>

    <nav class="wizard-stepper" aria-label="First-run demo steps">
      <ol class="wizard-steps">
        {#each DEMO_STEPS as step, i}
          <li
            class="wizard-step"
            class:wizard-step-active={i === stepIndex}
            class:wizard-step-done={i < stepIndex}
          >
            <button
              type="button"
              class="wizard-step-btn"
              aria-current={i === stepIndex ? "step" : undefined}
              on:click={() => goTo(i)}
            >
              <span class="wizard-step-num" aria-hidden="true">{i < stepIndex ? "✓" : i + 1}</span>
              <span class="wizard-step-label">{step.shortLabel}</span>
            </button>
          </li>
          {#if i < DEMO_STEPS.length - 1}
            <li class="wizard-connector" aria-hidden="true"></li>
          {/if}
        {/each}
      </ol>
    </nav>

    <header class="wizard-header">
      <p class="wizard-kicker">Step {stepIndex + 1} of {DEMO_STEPS.length}</p>
      <h3 class="wizard-title">{currentStep.headline}</h3>
    </header>

    <div
      class="product-demo-frame-wrap"
      class:product-demo--paused={paused}
      role="region"
      aria-label="Interactive product demo — pauses auto-advance on hover"
      on:mouseenter={onFrameEnter}
      on:mouseleave={onFrameLeave}
    >
      <div class="product-demo-frame-chrome" aria-hidden="true">
        <span class="product-demo-frame-stamp">Restormel · First run</span>
        <span class="product-demo-frame-chrome-mark">DEMO</span>
      </div>
      <div class="product-demo-frame">
        {#key stepIndex}
          <div class="product-demo-frame-inner connect-pipeline">
            <ProductDemoStepPanels stepId={currentStep.id} {visibleLogLines} />
          </div>
        {/key}
      </div>
      <div class="product-demo-timer" aria-hidden="true">
        {#key timerKey}
          <div class="product-demo-timer-fill" style="--demo-step-duration: {stepDurationSec}"></div>
        {/key}
      </div>
    </div>

    <div class="product-demo-controls">
      <p class="product-demo-caption">{currentStep.caption}</p>
      <div class="product-demo-nav">
        <button type="button" class="btn btn-outline" disabled={stepIndex === 0} on:click={prevStep}>Prev</button>
        <button
          type="button"
          class="btn btn-primary"
          disabled={stepIndex === DEMO_STEPS.length - 1}
          on:click={nextStep}
        >
          Next
        </button>
      </div>
    </div>
  </div>
</section>

<style>
  .product-demo-section {
    padding: var(--space-10, 4rem) 0;
    border-top: var(--border);
    background: var(--color-bg-page, var(--color-bg));
  }

  .product-demo.connect-pipeline .wizard-header {
    margin-bottom: var(--space-3);
  }

  .product-demo.connect-pipeline .wizard-title {
    font-size: var(--text-lg);
    margin: 0;
  }
</style>
