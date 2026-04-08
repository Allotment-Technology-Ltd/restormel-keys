<script lang="ts">
  import { base } from "$app/paths";
  import DocArticle from "$lib/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Overview"
  description="Restormel Testing is open-source infrastructure for goal-based, workflow-aware tests of AI-enabled software—local development and CI/CD—with bring-your-own-key execution through Restormel Keys."
>
  <div class="doc-prose">
    <p>
      It targets the gap between classic deterministic tests and one-off prompt evals: <strong>product-level outcomes</strong>
      (browser journeys, agents, retrieval-aware flows) with <strong>structured verdicts</strong> and
      <strong>CI-native artefacts</strong>.
    </p>
    <p>
      It is <strong>not</strong> a Playwright product, a generic eval dashboard, or an observability platform—it composes
      with those layers instead of replacing them.
    </p>
    <p>
      Next: <a href="{base}/docs/how-it-fits-together">How it fits together</a> ·
      <a href="{base}/docs/walkthrough">Walkthrough</a>
    </p>
  </div>
</DocArticle>
