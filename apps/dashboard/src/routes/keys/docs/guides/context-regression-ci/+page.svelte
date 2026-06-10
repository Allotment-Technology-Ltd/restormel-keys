<svelte:head>
  <title>Context-regression CI — Restormel Keys</title>
  <meta
    name="description"
    content="Gate every pull request on Connect graph quality: keys connect eval --baseline in CI, the composite GitHub/Forgejo action with a sticky PR comment, baseline lifecycle, warn vs blocking mode, and the weekly cross-model efficacy run that keeps the claims ledger honest."
  />
</svelte:head>

<div class="doc-content">
  <h1>Context-regression CI</h1>
  <p class="doc-intro">
    Verified context is only trustworthy while it is re-measured. This guide wires the
    <code class="inline-code">keys connect eval</code> quality verdict into CI so a pull request that would
    degrade your graph's quality fails (or warns) <em>before</em> merge, with the regression table posted as a
    single, continuously updated PR comment. It also covers the scheduled cross-model efficacy run that keeps
    the published verification claims continuously true as models change.
  </p>

  <div class="callout callout-tip">
    <strong>One comment, ever.</strong> The CI action finds its previous PR comment by an invisible marker and
    edits it in place. Pushing ten times to a PR produces one up-to-date regression table, not ten comments.
  </div>

  <h2 id="exit-codes">The contract: one command, four exit codes</h2>
  <p>
    Everything in this guide is a wrapper around one headless command. It evaluates a graph's quality report
    against the published G2 bar (≥ 90% supported, ≤ 2% unsupported) and, when given a baseline, diffs against
    the last accepted state:
  </p>
  <pre class="code-block"><code>{`keys connect eval \\
  --baseline ci/connect-eval-baseline.json \\
  --tolerance 1 \\
  --output markdown`}</code></pre>
  <table class="doc-table">
    <thead>
      <tr>
        <th scope="col">Exit code</th>
        <th scope="col">Meaning</th>
        <th scope="col">CI behavior</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>0</code></td>
        <td>Quality bar met, no regression beyond tolerance</td>
        <td>Check passes</td>
      </tr>
      <tr>
        <td><code>1</code></td>
        <td>Graph misses the absolute G2 bar</td>
        <td>Check fails (warn mode: reported, exit 0)</td>
      </tr>
      <tr>
        <td><code>2</code></td>
        <td>Config / usage error — the gate could not evaluate</td>
        <td>Check fails — <em>never</em> downgraded by warn mode</td>
      </tr>
      <tr>
        <td><code>3</code></td>
        <td>Quality regressed vs the committed baseline</td>
        <td>Check fails (warn mode: reported, exit 0)</td>
      </tr>
    </tbody>
  </table>
  <p>
    Two failure codes are deliberate: <code class="inline-code">1</code> means "this graph is below the
    published bar, full stop"; <code class="inline-code">3</code> means "still above the bar, but worse than
    the state your team last accepted". A baseline regression on a passing graph is the early warning you want
    from CI.
  </p>

  <h2 id="action">The composite action</h2>
  <p>
    <code class="inline-code">packages/connect-eval-github-action</code> wraps the command for GitHub Actions
    and Forgejo. Remote mode evaluates the latest completed ingest run of a workspace through the
    gateway-key-authed Connect v1 API:
  </p>
  <pre class="code-block"><code>{`permissions:
  contents: read
  pull-requests: write   # sticky comment

- uses: ./packages/connect-eval-github-action
  with:
    gateway_key: \${{ secrets.RESTORMEL_GATEWAY_KEY }}   # secret — never logged
    workspace: \${{ vars.RESTORMEL_WORKSPACE_ID }}
    project: \${{ vars.RESTORMEL_PROJECT_ID }}            # optional
    baseline_path: ci/connect-eval-baseline.json
    tolerance: '1'
    github_token: \${{ secrets.GITHUB_TOKEN }}`}</code></pre>
  <p>
    Local counts mode (<code class="inline-code">counts_path</code>) evaluates a counts or quality-report JSON
    produced by any pipeline — no network, no key — which is how this repository dogfoods the gate on every PR
    to the Connect quality pipeline. The gateway key travels to the CLI via environment only, never argv, and
    is never printed.
  </p>
  <p>The action exposes four outputs for downstream steps:</p>
  <ul>
    <li><code class="inline-code">verdict</code> — <code>pass</code> · <code>quality_fail</code> · <code>regression</code> · <code>config_error</code> · <code>error</code></li>
    <li><code class="inline-code">exit_code</code> — the raw CLI code (0/1/2/3) before any warn-mode downgrade</li>
    <li><code class="inline-code">regression</code> — <code>"true"</code> when the baseline diff flagged a regression</li>
    <li><code class="inline-code">commented</code> — <code>"true"</code> when the sticky comment was created or updated</li>
  </ul>

  <h2 id="baseline">Baseline lifecycle</h2>
  <p>
    The baseline is a committed JSON artifact written by
    <code class="inline-code">keys connect eval --save-baseline &lt;file&gt;</code>. It records the accepted
    verdict and the <strong>source-set fingerprint</strong> of the corpus it was measured on. Three rules keep
    it honest:
  </p>
  <ul>
    <li>
      <strong>Fingerprint supersession, not false alarms.</strong> When the corpus changes, the fingerprint
      changes and the diff reports <em>baseline superseded</em> — regression checks are skipped, never reported
      as failures. Re-save the baseline from the new corpus to re-arm the gate.
    </li>
    <li>
      <strong>Tolerance absorbs rounding.</strong> G2 percentages are integer-rounded, so the default
      1-point tolerance absorbs jitter. Raise it deliberately rather than deleting the baseline.
    </li>
    <li>
      <strong>Re-saving is a review event.</strong> The baseline lives in git; accepting a lower bar is a
      visible diff in the PR, not a silent state change.
    </li>
  </ul>

  <h2 id="warn-vs-blocking">Warn mode vs blocking</h2>
  <p>
    Start non-blocking: <code class="inline-code">warn_only: 'true'</code> reports quality failures and
    regressions in the summary and the sticky comment but exits 0, so teams can tune tolerance and baselines
    without red checks. Config errors (exit 2) still fail even in warn mode — a gate that cannot evaluate must
    be loud, or it rots silently. Flip to blocking once the gate evaluates a live ingest (remote mode) and the
    baseline has been re-saved from that run.
  </p>

  <h2 id="forgejo">Forgejo mirrors</h2>
  <p>
    The sticky comment uses the GitHub-compatible issues API at <code class="inline-code">GITHUB_API_URL</code>,
    which Forgejo also serves, so the same action runs unchanged in
    <code class="inline-code">.forgejo/workflows</code>. One sharp edge: when a repository has a
    <code class="inline-code">.forgejo/workflows</code> directory, it <strong>overrides</strong>
    <code class="inline-code">.github/workflows</code> on the Forgejo side — a gate added only under
    <code class="inline-code">.github</code> never runs on the mirror. Ship both variants in the same PR and
    keep them in sync.
  </p>

  <h2 id="claims-integrity">Scheduled claims-integrity run</h2>
  <p>
    Quality bars about <em>verification itself</em> ("the validator catches fabricated claims") cannot be
    proven once and assumed forever — model and routing changes can silently invalidate them. A weekly
    scheduled workflow re-runs the verifier-efficacy benchmark under <strong>cross-model routing</strong>
    (extraction and validation on different model families, keyed by the
    <code class="inline-code">OPENAI_API_KEY</code> and <code class="inline-code">TOGETHER_API_KEY</code> CI
    secrets) and fails if any signed-off bar regresses:
  </p>
  <ul>
    <li>fabricated-claim recall ≥ 95%</li>
    <li>cross-model misattribution recall ≥ 90%</li>
    <li>supported false-flag rate ≤ 15%</li>
    <li>affirm-unseen 0% under cross-model routing (the fail-open probe)</li>
  </ul>
  <p>
    Each run uploads a dated results snapshot and prints the bar table in the run summary; the claims ledger
    points at this workflow as the continuous evidence for its measured rows. A red run means the affected
    ledger rows — and any marketing copy citing them — are treated as broken until the bar recovers.
  </p>

  <h2 id="repro">Reproduce locally</h2>
  <pre class="code-block"><code>{`# evaluate the latest ingest run of your workspace
RESTORMEL_GATEWAY_KEY=… keys connect eval --workspace ws_… --output pretty

# save the accepted state as the CI baseline
keys connect eval --workspace ws_… --save-baseline ci/connect-eval-baseline.json

# what CI runs on every PR
keys connect eval --workspace ws_… \\
  --baseline ci/connect-eval-baseline.json --tolerance 1 --output markdown
echo "exit: $?"   # 0 pass · 1 bar miss · 2 config · 3 regression`}</code></pre>
  <p>
    Related reading: <a href="/keys/docs/guides/verified-context">Verified context</a> (what the verdict
    measures and how to audit it) and
    <a href="/keys/docs/guides/connect-first-graph-onboarding">Connect first graph onboarding</a> (producing
    the ingest runs the gate evaluates).
  </p>
</div>
