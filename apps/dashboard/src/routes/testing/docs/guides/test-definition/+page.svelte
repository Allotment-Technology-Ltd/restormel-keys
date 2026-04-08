<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Test definition"
  description="Goals express user-meaningful outcomes. Success criteria combine deterministic checks with narrow rubric-backed judgements where needed."
>
  <div class="doc-prose">
    <p>MVP success-criteria shapes include:</p>
    <ul>
      <li>URL match, DOM signals, text presence or absence.</li>
      <li>Lightweight structured extraction via CSS selectors (<code>structured_checks</code>).</li>
      <li>
        <code>judge_rubric</code> for tightly bounded cases — needs Keys HTTP resolve or the documented OpenAI fallback; use optional
        <code>context_selector</code> so the judge sees only a slice of the page (avoid full-page dumps and PII).
      </li>
    </ul>
    <p>
      Every goal should be <strong>business meaningful</strong>; avoid exploratory “test everything” goals in early suites.
    </p>
    <p>
      Verdicts: <code>passed</code>, <code>failed</code>, <code>indeterminate</code>—with reason codes and evidence for CI triage.
    </p>
    <p>
      <a href="{base}/docs/guides/config">Configuration</a> ·
      <a href="{base}/docs/guides/plot-dogfooding">Plot dogfooding</a>
    </p>
  </div>
</DocArticle>
