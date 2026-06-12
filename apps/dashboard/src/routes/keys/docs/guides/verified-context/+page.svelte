<svelte:head>
  <title>Verified context — Restormel Keys</title>
  <meta
    name="description"
    content="What 'verified' means in Restormel Connect: evidence-bound claims, fail-safe pipeline gates, the G2 quality bar, provenance trace export, and verification rules — written so an auditor can check every guarantee themselves."
  />
</svelte:head>

<div class="doc-content">
  <h1>Verified context</h1>
  <p class="doc-intro">
    Restormel Connect serves knowledge-graph context to AI applications with a verification chain attached
    to every claim. This page defines exactly what "verified" means on this API, which guarantees the
    pipeline enforces, and — most importantly — how you can check each one yourself. It is written for the
    person auditing a deployment, not only the developer integrating it.
  </p>

  <div class="callout callout-tip">
    <strong>The falsifiability test.</strong> Every claim served as <code class="inline-code">supported</code>
    carries the quoted evidence span, its character offsets, and a content hash of the exact source version it
    was bound against. A skeptical reader can open the cited source and check the quote themselves. If a
    surface cannot show that chain, it does not say "verified".
  </div>

  <h2>At a glance</h2>
  <table class="doc-table">
    <thead>
      <tr>
        <th scope="col">Guarantee</th>
        <th scope="col">Mechanism</th>
        <th scope="col">How you check it</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>A claim is never "supported" without locatable evidence</td>
        <td>Deterministic evidence binding (quote + offsets + source-version hash)</td>
        <td>Re-find the quote at its offsets in the cited source; compare the hash</td>
      </tr>
      <tr>
        <td>Misattributed claims are structurally caught</td>
        <td>Binding runs against the <em>cited</em> source only — a quote from elsewhere fails</td>
        <td>The envelope's <code class="inline-code">evidence</code> is empty and the state is not <code class="inline-code">supported</code></td>
      </tr>
      <tr>
        <td>A missing verdict is never a pass</td>
        <td>Fail-safe coverage finalizers: omitted or unparseable verdicts become coverage gaps</td>
        <td>Unjudged claims surface as <code class="inline-code">unverified</code>, never as supported</td>
      </tr>
      <tr>
        <td>Uncertainty is flagged, not blended</td>
        <td>The judge may abstain; abstention and low confidence route to review</td>
        <td>Per-claim <code class="inline-code">state</code> + <code class="inline-code">verification_summary</code> counts on every response</td>
      </tr>
      <tr>
        <td>Every retrieval is auditable after the fact</td>
        <td>Provenance trace recorded per query (included <em>and</em> excluded claims, with reasons)</td>
        <td>Export the trace: <code class="inline-code">GET /connect/v1/traces/&#123;trace_id&#125;/export?format=json</code></td>
      </tr>
      <tr>
        <td>Graph quality is held to a published bar</td>
        <td>G2 gate: ≥ 90% supported, ≤ 2% unsupported across validated claims</td>
        <td>Quality report on every ingest job; webhook on threshold breach</td>
      </tr>
      <tr>
        <td>Scoring rules are inspectable, not implicit</td>
        <td>Versioned verification rule sets (six weighted dimensions, named policies)</td>
        <td><code class="inline-code">GET /connect/v1/verification-rules</code></td>
      </tr>
    </tbody>
  </table>

  <h2 id="states">What "verified" means: the five states</h2>
  <p>
    Verification is two-layered, per the Evidence-Bound Verification design. <strong>Layer 1</strong> is
    deterministic and model-free: at ingest, every extracted claim must bind a quoted evidence span to exact
    character offsets in the cited source version, recorded with that version's SHA-256 content hash. Anyone
    can re-run this check at any time — if the source changed or the quote is not where it was bound, the
    check fails. <strong>Layer 2</strong> is a narrow entailment judgment: a model is asked only "does this
    bound span entail this claim?", and it may abstain. The judge runs on a different model family than the
    extractor, so the system that writes claims never grades its own work. Every verdict is recorded with the
    judge's model id, prompt version, and timestamp, append-only — re-judging adds history, it never rewrites it.
  </p>
  <table class="doc-table">
    <thead>
      <tr>
        <th scope="col">State</th>
        <th scope="col">Meaning</th>
        <th scope="col">Requires</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>supported</code></td>
        <td>Evidence-bound and entailed</td>
        <td>Layer 1 pass <em>and</em> Layer 2 entailed</td>
      </tr>
      <tr>
        <td><code>inferred</code></td>
        <td>Entailed, but no directly bound span — always labeled as inference</td>
        <td>Layer 2 entailed; Layer 1 partial</td>
      </tr>
      <tr>
        <td><code>unverified</code></td>
        <td>Judge abstained, low confidence, or no bindable evidence</td>
        <td>Routed to the human review queue</td>
      </tr>
      <tr>
        <td><code>contradicted</code></td>
        <td>Evidence entails the negation</td>
        <td>Review; excluded from strict retrieval</td>
      </tr>
      <tr>
        <td><code>excluded</code></td>
        <td>Remediation or operator decision</td>
        <td>Reversible soft-exclude — the record is kept, out of active use</td>
      </tr>
    </tbody>
  </table>
  <p>
    The asymmetry is deliberate: a claim with no locatable evidence in its cited source can <em>never</em> be
    <code class="inline-code">supported</code>, whatever any judge said about it. This is what closes the
    misattribution hole — a claim that is true somewhere else in the corpus but cited to the wrong source fails
    the deterministic binding, no judgment required. Graphs verified before this design (or imported from
    elsewhere) are normalized through the same rule: a legacy-affirmed claim without a bound span is served as
    <code class="inline-code">inferred</code> at best.
  </p>

  <h2 id="envelope">The verification chain on every response</h2>
  <p>
    Retrieval responses (<code class="inline-code">POST /connect/v1/retrieve</code> and
    <code class="inline-code">POST /connect/v1/graph</code>) carry a <strong>verified-claim envelope</strong>
    per returned unit, plus a per-state summary in the response metadata so a consumer can gate on "anything
    non-supported in this context?" without scanning every claim:
  </p>
  <pre class="code-block"><code>{`{
  "claim": { "id": "claim:7rk2…", "text": "Virtue is a mean between two vices." },
  "state": "supported",
  "evidence": [
    {
      "quote": "virtue is a mean between two vices, the one involving excess, the other deficiency",
      "offsets": [18204, 18289],
      "source_ref": "source:nicomachean_ethics",
      "source_hash": "9f2c41…e7",
      "match": "exact"
    }
  ],
  "judge": {
    "model": "gemini-2.0-flash",
    "prompt_version": 1,
    "confidence": 0.93,
    "at": "2026-06-10T12:04:11.000Z"
  },
  "citation": "Nicomachean Ethics, Book II",
  "trace_ref": "/connect/v1/traces/3f6f9a3a-…",
  "trust_score": 88
}`}</code></pre>
  <p>
    Three honesty rules govern this envelope. Evidence is never fabricated: if a span could not be bound, the
    array is empty and the state says so. Judge attribution is never invented: if a claim has not been judged,
    the field is omitted. And anything looser than an exact quote match is labeled
    (<code class="inline-code">normalized</code> or <code class="inline-code">fuzzy</code>), never hidden.
    Requests can also pass <code class="inline-code">require_verified</code> (or an explicit
    <code class="inline-code">verification_policy</code>) to exclude non-supported claims from the context
    entirely — exclusions are then counted and recorded in the trace, not silently dropped.
  </p>

  <h2 id="gates">Fail-safe gates in the ingest pipeline</h2>
  <p>
    The pipeline that builds the graph (extract → relate → group → embed → validate → remediate → store)
    fails <em>safe</em>, not open. The gates an auditor should know about:
  </p>
  <ul>
    <li>
      <strong>Coverage finalizers.</strong> Validation and entailment run in batches against live models, and
      models sometimes omit items or return malformed output. Any claim the judge did not return a verdict
      for is finalized as a coverage gap — recorded as an abstention and routed to review. An omission can
      never default to a pass.
    </li>
    <li>
      <strong>Abstention is an outcome, not an error.</strong> The entailment judge is explicitly allowed to
      answer "cannot verify". Abstentions and low-confidence verdicts land in the review queue; they are never
      laundered into a softer passing grade.
    </li>
    <li>
      <strong>Remediation cannot resurrect.</strong> Claims flagged weak or unsupported go through a repair
      pass; repaired text must re-bind its evidence before it can return to circulation, and claims that cannot
      be supported are soft-excluded — reversibly, with the record and its history retained.
    </li>
    <li>
      <strong>Verification cannot silently rot.</strong> Because the Layer-1 check is deterministic over hashed
      content, it is re-runnable at read time. If a source version changes, bindings against the old hash fail
      the re-check rather than continuing to vouch for text that no longer exists.
    </li>
  </ul>
  <p>
    The validator itself is measured against planted ground truth, not assumed. The most recent benchmark
    (2026-06-10, cross-model routing: extraction on <code class="inline-code">gpt-4o-mini</code>, validation on
    <code class="inline-code">Llama-3.3-70B</code>) measured 100% recall on planted fabricated and misattributed
    claims, a 14.5% false-flag rate on known-good claims, and 0% affirm rate on claims the validator was never
    shown — that last probe being the direct test that the fail-safe gates hold under real model behaviour.
    Numbers are point-in-time, tied to those model versions, and re-measured when models or routes change.
  </p>

  <h2 id="g2">The G2 quality bar</h2>
  <p>
    A graph is not "done" because ingest finished; it is done when it clears the published bar. The G2 gate
    requires <strong>at least 90% of validated claims supported</strong> and
    <strong>at most 2% unsupported</strong>. Every ingest job's quality report states the trust score (0–100)
    and the supported / weak / unsupported breakdown, so the bar is checkable per run rather than asserted
    globally. The trust score weighs verification coverage and embedding coverage most heavily, alongside
    structural health (orphan rate, vector index presence, relation balance), minus a penalty for
    high-severity issues. You can register a webhook (<code class="inline-code">job.quality_below_threshold</code>)
    to be notified when a run lands under your threshold — quality failures are pushed to you, not buried in a log.
  </p>

  <h2 id="traces">Provenance traces and export</h2>
  <p>
    Every retrieval query produces a structured audit trace answering "why did the agent get this context?" —
    the question regulators and internal audit actually ask. The trace records the query, the verification
    policy in force, the seed claims chosen, the graph expansion, and a per-claim verdict for everything the
    engine <em>considered</em>: included claims with their verification state and trust score, and excluded
    claims with the reason they were dropped (verification gate, confidence gate, duplicate). Traces are
    retained for 90 days and are workspace-scoped.
  </p>
  <ul>
    <li><code class="inline-code">GET /connect/v1/traces/&#123;trace_id&#125;</code> — the versioned trace document</li>
    <li><code class="inline-code">GET /connect/v1/traces/&#123;trace_id&#125;/export?format=json</code> — downloadable export for audit files</li>
  </ul>
  <p>
    The <code class="inline-code">trace_ref</code> on every verified-claim envelope links the claim back to the
    exact query that served it, so a finding in an AI system's output can be walked back to context, claim,
    evidence span, and source version in four steps.
  </p>

  <h2 id="rules">Verification rules are public configuration</h2>
  <p>
    The reasoning-quality scoring behind verification is not an implicit prompt; it is a versioned rule set.
    Each rule set defines six weighted dimensions — logical structure, evidence grounding, counterargument
    coverage, scope calibration, assumption transparency, internal consistency — with per-dimension passing
    thresholds and named policies (strict / balanced / lenient) that set the overall pass and weak-claim
    thresholds. Workspaces may override weights per domain pack; the override is itself inspectable.
  </p>
  <ul>
    <li><code class="inline-code">GET /connect/v1/verification-rules</code> — the rule set active for your workspace</li>
    <li><code class="inline-code">GET /connect/v1/verification-rules/built-in</code> — the built-in "Restormel Core v1" definition</li>
  </ul>

  <h2 id="audit">Auditing a claim yourself</h2>
  <ol class="doc-ol">
    <li>Retrieve context and read the <code class="inline-code">verified_claims</code> envelopes; check <code class="inline-code">metadata.verification_summary</code> for anything non-supported.</li>
    <li>For any claim, take <code class="inline-code">evidence[0].quote</code>, <code class="inline-code">offsets</code>, and <code class="inline-code">source_hash</code>.</li>
    <li>Fetch the cited source version and confirm the quote sits at those offsets and the content hashes to the recorded value. A mismatch is a finding — the claim should not be in a supported context.</li>
    <li>Follow <code class="inline-code">trace_ref</code> and export the trace; confirm the verification policy and that exclusions carry reasons.</li>
    <li>Fetch the active verification rules and confirm the policy thresholds match what your deployment claims to enforce.</li>
  </ol>

  <h2>Related actions</h2>
  <ul>
    <li><a href="/keys/docs/api-reference">API reference</a> — the OpenAPI spec covering retrieve, graph, traces, and verification-rules endpoints</li>
    <li><a href="/keys/docs/guides/connect-first-graph-onboarding">Connect first graph onboarding</a> — build the graph these guarantees apply to</li>
    <li><a href="/keys/dashboard/home">Dashboard home</a> — ingest setup, graph store, and quality reports for your workspace</li>
  </ul>

  <p>
    <strong>Engineering reference:</strong>
    <code class="inline-code">docs/decisions/evidence-bound-verification.md</code> in the repository is the
    canonical design record this page summarizes; the envelope's canonical schema is
    <code class="inline-code">@restormel/contracts</code> (<code class="inline-code">verified-claim.ts</code>).
  </p>
</div>
