<script lang="ts">
  import type { SuggestedQuestion } from "$lib/connect/graph-comparison-types";
  import SuggestedQuestions from "./SuggestedQuestions.svelte";

  export let value = "";
  export let running = false;
  export let graphEmpty = false;
  export let suggestions: SuggestedQuestion[] = [];
  export let suggestionsLoading = false;
  export let suggestionsFailed = false;
  export let onCompare: (question: string) => void;
  export let onSelectSuggestion: (question: SuggestedQuestion) => void;

  let textarea: HTMLTextAreaElement | undefined;

  $: tooShort = value.trim().length < 10;
  $: disabledReason = graphEmpty
    ? "Connect a source first, then ask it anything."
    : tooShort
      ? "Ask a full question to get a useful answer."
      : "";
  $: canCompare = !running && !graphEmpty && !tooShort;

  function autoGrow(): void {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function submit(): void {
    if (!canCompare) return;
    onCompare(value.trim());
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }
</script>

<div class="question">
  <div class="question-row">
    <textarea
      bind:this={textarea}
      bind:value
      on:input={autoGrow}
      on:keydown={onKeydown}
      rows="1"
      class="question-input"
      placeholder="Ask your sources anything they'd know the answer to…"
      aria-label="Your question"
    ></textarea>
    <button
      type="button"
      class="compare-btn brut-pressable brut-focus"
      disabled={!canCompare}
      title={disabledReason || undefined}
      on:click={submit}
    >
      ASK →
    </button>
  </div>

  <SuggestedQuestions
    questions={suggestions}
    loading={suggestionsLoading}
    failed={suggestionsFailed}
    disabled={running || graphEmpty}
    onSelect={onSelectSuggestion}
  />
</div>

<style>
  .question-row {
    display: flex;
    align-items: stretch;
    gap: var(--space-3);
  }

  .question-input {
    flex: 1;
    min-height: 3rem;
    max-height: 12rem;
    resize: none;
    padding: var(--space-3) var(--space-4);
    border: var(--border);
    border-radius: 0;
    background: var(--color-surface);
    color: var(--color-ink);
    font-family: var(--font-body);
    font-size: var(--text-body-md);
    line-height: 1.5;
  }
  .question-input::placeholder {
    color: var(--color-ink-faint);
  }
  .question-input:focus {
    outline: 2px solid var(--color-ink);
    outline-offset: 2px;
  }

  .compare-btn {
    align-self: flex-start;
    flex-shrink: 0;
    padding: var(--space-3) var(--space-5);
    border: var(--border);
    border-radius: 0;
    background: var(--color-yellow);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    cursor: pointer;
  }
  .compare-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  @media (max-width: 640px) {
    .question-row {
      flex-direction: column;
    }
    .compare-btn {
      align-self: stretch;
    }
  }
</style>
