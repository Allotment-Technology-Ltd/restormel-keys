<svelte:head>
  <title>Release pack and CI merge gates — Restormel Keys</title>
  <meta
    name="description"
    content="Exportable Release pack linking route version, policy version, and Restormel Testing AC results; CI merge gate examples."
  />
</svelte:head>

<div class="doc-content">
  <h1>Release pack and CI merge gates</h1>
  <p class="doc-intro">
    The <strong>Release pack</strong> is an exportable JSON artifact that ties <strong>control-plane versions</strong> to <strong>Testing acceptance results</strong>—a practical “safe to ship” signal for PMs and compliance reviewers.
    It does not replace legal sign-off; it <strong>reduces</strong> “what did we test?” ambiguity.
  </p>

  <h2>Schema</h2>
  <p>
    <code>schema_version</code>: <code>restormel-release-pack/1</code>. Produced by <code>@restormel/testing-report</code> and the CLI command <code>testing release-pack</code>.
    Fields include optional <code>control_plane.route_version</code>, <code>control_plane.policy_version</code>, embedded Testing summary, and a reference to the underlying MVP report version.
  </p>

  <h2>CLI</h2>
  <pre class="doc-pre"><code>testing release-pack \
  --from-run .restormel-testing/runs/run-2026-04-10 \
  --route-version "route@7" \
  --policy-version "policy@3" \
  --out release-pack.json</code></pre>

  <h2>Merge gate pattern</h2>
  <p>
    Run Testing in CI; fail the job if overall verdict is not <code>passed</code>. Upload <code>release-pack.json</code> as a workflow artifact for auditors.
    Example workflow: <code>examples/github-actions/restormel-testing-merge-gate.yml</code> in this repository.
  </p>

  <h2>Runner economics</h2>
  <p>
    Use <strong>customer-paid</strong> GitHub Actions minutes or your self-hosted pool. If Restormel ever funds runners, treat that as a <strong>priced</strong> SKU—otherwise gross margin on Testing compresses.
  </p>
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-intro {
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    line-height: var(--leading-relaxed);
  }
  .doc-content h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-4);
  }
  .doc-content h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: var(--space-8) 0 var(--space-3);
  }
  .doc-content p {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-3);
  }
  .doc-pre {
    background: var(--rm-surface-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    overflow-x: auto;
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
</style>
