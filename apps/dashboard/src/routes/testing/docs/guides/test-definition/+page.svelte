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
      <li>
        <strong>Default bundle is AND.</strong> <code>url_matches</code>, <code>dom_signals</code>, text checks, and <code>structured_checks</code> in the same
        <code>success_criteria</code> object must all pass. For <strong>OR</strong> composition (e.g. hero <em>or</em> launcher <em>or</em> empty state), use
        <code>any_of</code> / <code>anyOf</code> with nested criteria objects (see repo <code>docs/testing/config-reference-mvp.md</code>).
      </li>
      <li>
        <code>structured_checks</code> — documented <code>css:…</code> paths; in-page Web Vitals via <code>vital:lcp</code> (and <code>fcp</code> /
        <code>cls</code>, plus <code>web_vitals:</code> aliases); full category audits via <code>lighthouse:…</code> / <code>lh:…</code> (separate Chrome
        session — no Playwright cookies). Unsupported paths return <strong>indeterminate</strong> with a reason code.
      </li>
      <li>
        <code>judge_rubric</code> for tightly bounded cases — needs Keys HTTP resolve or the documented OpenAI fallback; use optional
        <code>context_selector</code> so the judge sees only a slice of the page (avoid full-page dumps and PII). Purely deterministic
        suites can omit Keys entirely; see <a href="{base}/docs/guides/keys-ci-checklist">Keys in CI (checklist)</a> and
        <a href="{base}/docs/guides/keys-dashboard-onboarding">Keys + Testing (dashboard)</a>.
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
      <a href="{base}/docs/guides/performance-goals">Performance goals</a> ·
      <a href="{base}/docs/guides/plot-dogfooding">Plot dogfooding</a>
    </p>
  </div>
</DocArticle>
