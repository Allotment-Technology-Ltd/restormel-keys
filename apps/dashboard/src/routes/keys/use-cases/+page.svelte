<script lang="ts">
  /**
   * Marketing claims ledger citations (docs/product/verified-context-claims-ledger.md):
   * - "Every claim carries a provenance trace" → row #7 (proven)
   * - "Published quality bar: ≥90% supported, ≤2% unsupported" → row #8 (proven)
   * - "The validator catches fabricated claims" → row #6 (proven, continuously enforced)
   * - "A different model family checks the extraction" → row #5 (proven)
   * - "Every claim is validated against its source" → row #1 (proven)
   * - "Verification cannot silently rot" → row #9 (proven)
   */

  const heroThesisPanels = [
    {
      title: "What Keys actually is",
      body: "A library-first control layer you embed in your app: routing, policy, fallbacks, BYOK boundaries, entitlements, and optional UI—without running Keys as your traffic proxy or model marketplace.",
    },
    {
      title: "What this page proves",
      body: "Two shipped products stress different constraints. The overlap is not coincidence: the same primitives (resolve, policy, allowlists, server-side keys) keep showing up because that is the product.",
    },
  ];

  const fitModes = [
    {
      title: "Builder-side routing",
      line: "You choose providers, fallbacks, and guard rails from your backend using dashboard-owned configuration.",
      usedWhen: "You still call OpenAI, OpenRouter, or your stack directly—but “which model and path” is not hardcoded per handler.",
    },
    {
      title: "End-user BYOK",
      line: "End users bring provider keys; your app stores and validates them server-side while Keys enforces what they may run.",
      usedWhen: "Your SaaS must offer model choice without becoming a key vault product from scratch.",
    },
    {
      title: "Combined mode",
      line: "Platform defaults and user keys coexist: shared policy, shared allowlists, one resolve path.",
      usedWhen: "Operators need control while power users or tenants supply their own credentials.",
    },
  ];

  const sharedPrimitives = [
    { name: "Resolve", detail: "One call path from model intent to executable provider context." },
    { name: "Policy", detail: "Allow, deny, and scope before expensive or sensitive work runs." },
    { name: "Allowlists", detail: "Live project rules that can drive both API behavior and picker UX." },
    { name: "Fallback chains", detail: "Ordered backups when a provider or model fails—defined once, not per feature." },
    { name: "Key boundaries", detail: "Raw keys never in client surfaces; prefixes and hashes for support." },
    { name: "Dashboard config", detail: "Routes and policies change without redeploying handler branching." },
    { name: "Server-side credentials", detail: "Gateway and control-plane tokens stay in your server environment." },
    { name: "Operator controls", detail: "Admin paths reuse the same primitives as runtime—no shadow config." },
  ];

  const operatingLayers = [
    {
      label: "Your app UI",
      note: "Model pickers, settings, flows your users see.",
    },
    {
      label: "Your product logic",
      note: "Features, jobs, ingestion—your code owns the domain.",
    },
    {
      label: "Restormel Keys",
      note: "Embedded library + dashboard: routing, policy, BYOK contracts, entitlements.",
    },
    {
      label: "Provider access",
      note: "Direct APIs, gateways, or user-held keys—Keys does not replace these; it governs them.",
    },
  ];

  const patternCards = [
    {
      name: "Dashboard-owned routing",
      body: "Routes and steps live in configuration, not copy-pasted conditionals across handlers.",
      prevents: "Silent drift between “what we intended” and what production branches actually do.",
    },
    {
      name: "Fallback chains",
      body: "Declare ordered backups when a call fails instead of bespoke retry blocks per endpoint.",
      prevents: "Inconsistent recovery and opaque failures when a provider degrades.",
    },
    {
      name: "Server-side key custody",
      body: "Secrets stay on the server; the UI never displays full keys.",
      prevents: "Accidental exposure and un-auditable key handling in client bundles.",
    },
    {
      name: "Allowlists → policy + picker",
      body: "One source of truth feeds enforcement and what users can select.",
      prevents: "Users picking models your policy would reject after work already started.",
    },
    {
      name: "Shared resolve primitives",
      body: "Product APIs and operator tooling call the same resolve and policy surfaces.",
      prevents: "“Staging said yes, prod did something else” configuration schizophrenia.",
    },
    {
      name: "Policy before spend",
      body: "Check limits and blocks before you burn tokens on long jobs.",
      prevents: "Surprise cost and blocked work deep in a pipeline with no clear operator signal.",
    },
  ];
</script>

<svelte:head>
  <title>Use cases — Restormel Keys</title>
  <meta
    name="description"
    content="Proof from PLOT and Sophia: Restormel Keys as the embeddable builder-side layer for routing, BYOK, policy, and fallbacks—library-first, not a gateway."
  />
</svelte:head>

<article class="use-cases-page">
  <div class="container">
    <!-- 1. Hero: thesis + dual panels -->
    <header class="hero-ledger" aria-labelledby="use-cases-heading">
      <div class="hero-copy">
        <p class="hero-eyebrow">Product proof</p>
        <h1 id="use-cases-heading" class="hero-title">The control layer builders stop rebuilding</h1>
        <p class="hero-subhead">
          Every serious AI app eventually needs the same things: who may call which model, what happens when it fails, where keys live, and how ops
          changes behavior without shipping new branching logic.
        </p>
        <p class="hero-point">
          Restormel Keys is that layer—<strong>library-first</strong>, embedded in <em>your</em> app, not a separate traffic hop or model store.
          Below, two real products show the same primitives under different pressure—evidence of a reusable product, not two anecdotes.
        </p>
        <div class="hero-actions">
          <a href="/keys/dashboard/login" class="btn btn-primary">Start free</a>
          <a href="/keys/docs/walkthrough" class="btn btn-secondary">Integration walkthrough</a>
          <a href="/keys/docs" class="btn btn-secondary">Documentation</a>
        </div>
      </div>
      <div class="hero-panels">
        {#each heroThesisPanels as panel}
          <div class="hero-panel">
            <h2 class="hero-panel-title">{panel.title}</h2>
            <p class="hero-panel-body">{panel.body}</p>
          </div>
        {/each}
      </div>
    </header>

    <!-- 2. Three modes: intro + strong cards -->
    <section class="framing" aria-labelledby="fit-heading">
      <div class="framing-intro">
        <h2 id="fit-heading" class="framing-title">What Keys is for</h2>
        <p>
          Keys is not a generic AI gateway, observability suite, or marketplace. It is the <strong>builder-side</strong> slice: routing, policy,
          entitlements, cost awareness, embeddable key UX, and lightweight adoption paths—<strong>no Docker, Redis, or Postgres required to start</strong>.
        </p>
        <p class="framing-muted">
          Three valid ways to run it; most mature products end up in combined mode.
        </p>
      </div>
      <div class="mode-rail">
        {#each fitModes as mode}
          <article class="mode-card">
            <h3 class="mode-name">{mode.title}</h3>
            <p class="mode-line">{mode.line}</p>
            <p class="mode-when"><span class="mode-when-label">Used when</span> {mode.usedWhen}</p>
          </article>
        {/each}
      </div>
    </section>

    <!-- 3. Shared primitives -->
    <section class="primitives-block" aria-labelledby="primitives-heading">
      <div class="primitives-header">
        <h2 id="primitives-heading" class="primitives-title">Shared primitives</h2>
        <p class="primitives-lede">
          When you read PLOT and Sophia, watch for these names. They are the abstraction Keys sells: the same handles appear whether the workload is
          a single sensitive extraction or a multi-surface research engine.
        </p>
      </div>
      <ul class="primitive-list">
        {#each sharedPrimitives as p}
          <li class="primitive-item">
            <span class="primitive-name">{p.name}</span>
            <span class="primitive-detail">{p.detail}</span>
          </li>
        {/each}
      </ul>
    </section>

    <!-- 4. Operating model -->
    <section class="operating" aria-labelledby="operating-heading">
      <h2 id="operating-heading" class="operating-title">How Keys sits inside your app</h2>
      <p class="operating-lede">
        Keys runs <strong>in your process</strong> and talks to your database and env the way your code already does. The dashboard is configuration
        and visibility—not a mandatory proxy in front of user traffic.
      </p>
      <div class="flow-diagram flow-diagram--horizontal" aria-hidden="true">
        <svg viewBox="0 0 640 80" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" focusable="false">
          <rect class="flow-box" x="6" y="14" width="118" height="48" rx="4" ry="4" />
          <text class="flow-text" x="65" y="36" text-anchor="middle">Your app UI</text>
          <text class="flow-sub" x="65" y="50" text-anchor="middle">surfaces</text>
          <line class="flow-connector" x1="128" y1="38" x2="146" y2="38" />
          <polygon class="flow-arrowhead" points="154,38 146,34 146,42" />
          <rect class="flow-box" x="156" y="14" width="118" height="48" rx="4" ry="4" />
          <text class="flow-text" x="215" y="40" text-anchor="middle">Product logic</text>
          <line class="flow-connector" x1="278" y1="38" x2="296" y2="38" />
          <polygon class="flow-arrowhead" points="304,38 296,34 296,42" />
          <rect class="flow-box flow-box--keys" x="306" y="14" width="132" height="48" rx="4" ry="4" />
          <text class="flow-text" x="372" y="36" text-anchor="middle">Restormel Keys</text>
          <text class="flow-sub flow-sub--on-keys" x="372" y="50" text-anchor="middle">embed · policy · BYOK</text>
          <line class="flow-connector flow-connector--keys" x1="442" y1="38" x2="460" y2="38" />
          <polygon class="flow-arrowhead flow-arrowhead--keys" points="468,38 460,34 460,42" />
          <rect class="flow-box" x="470" y="14" width="164" height="48" rx="4" ry="4" />
          <text class="flow-text" x="552" y="36" text-anchor="middle">Provider access</text>
          <text class="flow-sub" x="552" y="50" text-anchor="middle">APIs · user keys</text>
        </svg>
      </div>
      <ol class="operating-stack" aria-label="Layers from UI to providers">
        {#each operatingLayers as layer, i}
          <li class="operating-row">
            <span class="operating-index" aria-hidden="true">{i + 1}</span>
            <div class="operating-text">
              <span class="operating-label">{layer.label}</span>
              <span class="operating-note">{layer.note}</span>
            </div>
          </li>
        {/each}
      </ol>
    </section>

    <!-- 4b. Verified context — regulated-industry use case -->
    <section id="verified-context" class="verified-block" aria-labelledby="verified-heading">
      <p class="case-label">Capability · verified context for regulated domains</p>
      <h2 id="verified-heading" class="case-name">Provenance-traced knowledge your auditors can check</h2>
      <p class="case-one-liner">
        Connect is the control plane for verified context — provenance-traced, quality-gated knowledge
        served to agents in domains where "the AI said so" is not an acceptable citation.
      </p>
      <div class="verified-proof-strip" aria-label="Published quality bars">
        <div class="verified-stat-item">
          <span class="verified-stat">≥ 90%</span>
          <span class="verified-stat-label">supported claims bar (G2 gate)</span>
        </div>
        <div class="verified-stat-item">
          <span class="verified-stat">100%</span>
          <span class="verified-stat-label">fabricated-claim recall<br/><span class="verified-stat-meta">2026-06-10 · cross-model · continuously re-run in CI</span></span>
        </div>
        <div class="verified-stat-item">
          <span class="verified-stat">0%</span>
          <span class="verified-stat-label">affirm-unseen under cross-model routing</span>
        </div>
      </div>
      <p class="verified-ledger-note">
        Numbers bound to: extractor <code class="inline-code">openai:gpt-4o-mini</code>, validator
        <code class="inline-code">together:meta-llama/Llama-3.3-70B-Instruct-Turbo</code>.
        Claims integrity enforced by the <a href="/keys/docs/guides/context-regression-ci#claims-integrity">weekly efficacy CI run</a>.
      </p>
      <dl class="case-meta verified-meta">
        <div>
          <dt>How it works</dt>
          <dd>
            Every extracted claim is bound to a verbatim quote, character offsets, and a SHA-256 of the source version.
            A cross-model validator then judges each span. A claim without a bound span can never be
            <code class="inline-code">supported</code>, regardless of what any judge said about it.
          </dd>
        </div>
        <div>
          <dt>Why cross-model matters</dt>
          <dd>
            The model that extracts claims never grades its own work. Under same-model routing,
            the validator affirmed unseen claims 66.7% of the time. Under cross-model: 0%.
            Cross-model routing is the product default, not an option.
          </dd>
        </div>
        <div>
          <dt>The audit trail</dt>
          <dd>
            Every retrieval query records a provenance trace: which claims were considered,
            their verification states, and why anything was excluded.
            Export it as JSON for your compliance file.
          </dd>
        </div>
      </dl>
      <div class="verified-industries">
        <h3 class="case-h3">Regulated-domain patterns</h3>
        <div class="verified-industry-grid">
          <div class="verified-industry-card">
            <span class="verified-industry-tag">Legal</span>
            <p>Case law and regulatory corpus with claim-level provenance. Cited passages carry the exact source version — counsel can verify a quote in seconds, not hours.</p>
          </div>
          <div class="verified-industry-card">
            <span class="verified-industry-tag">Pharma / Clinical</span>
            <p>Trial data and clinical guidelines with per-claim verification state. Contradicted or unsupported statements are excluded from agent context; the exclusion log is part of the trace.</p>
          </div>
          <div class="verified-industry-card">
            <span class="verified-industry-tag">Finance</span>
            <p>Earnings, filings, and research reports gated to the published quality bar. The trust scorecard shows current verification coverage at any time, not only after an ingest run.</p>
          </div>
        </div>
      </div>
      <p class="case-links">
        <a href="/keys/docs/guides/verified-context">Verified context guide</a>
        <span aria-hidden="true"> · </span>
        <a href="/connect">Restormel Connect</a>
        <span aria-hidden="true"> · </span>
        <a href="/keys/docs/guides/context-regression-ci">Context-regression CI</a>
      </p>
    </section>

    <!-- 5a. PLOT — practical adoption / privacy extraction -->
    <section id="plot" class="case-plot" aria-labelledby="plot-title">
      <p class="case-label">Case · practical adoption</p>
      <h2 id="plot-title" class="case-name">PLOT — Household Operating System</h2>
      <p class="case-one-liner">Privacy-first household finance: Vault document extraction where traceability and consent matter.</p>
      <dl class="case-meta">
        <div>
          <dt>Environment</dt>
          <dd>Next.js server routes; hosted policy evaluate + gateway auth.</dd>
        </div>
        <div>
          <dt>Constraints</dt>
          <dd>Household data, strict server-only credentials, minimal operational fuss.</dd>
        </div>
        <div>
          <dt>Why Keys fit</dt>
          <dd>Policy-driven extraction routing and fallbacks without nested provider branching in app code.</dd>
        </div>
      </dl>
      <p class="case-narrative">
        Extraction asks Keys which model path to use via policy (<code class="inline-code">plot.vault.extraction</code>). Primary and fallback routes
        are configured centrally; results carry routing metadata for audit without exposing secrets to the client.
      </p>
      <figure class="case-flow" aria-labelledby="plot-flow-caption">
        <figcaption id="plot-flow-caption" class="case-flow-caption">
          Simplified flow: household UI and Vault surfaces call Next.js server routes, which use Keys for resolve, fallbacks, and server-side credentials
          before model providers.
        </figcaption>
        <div class="flow-diagram flow-diagram--vertical" aria-hidden="true">
          <svg viewBox="0 0 260 246" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" focusable="false">
            <rect class="flow-box" x="30" y="6" width="200" height="38" rx="4" ry="4" />
            <text class="flow-text" x="130" y="24" text-anchor="middle">Household UI</text>
            <text class="flow-sub" x="130" y="36" text-anchor="middle">Vault &amp; consent</text>
            <line class="flow-connector" x1="130" y1="48" x2="130" y2="58" />
            <polygon class="flow-arrowhead" points="130,66 126,58 134,58" />
            <rect class="flow-box" x="30" y="66" width="200" height="38" rx="4" ry="4" />
            <text class="flow-text" x="130" y="84" text-anchor="middle">Next.js server</text>
            <text class="flow-sub" x="130" y="96" text-anchor="middle">evaluate · extraction route</text>
            <line class="flow-connector" x1="130" y1="108" x2="130" y2="118" />
            <polygon class="flow-arrowhead" points="130,126 126,118 134,118" />
            <rect class="flow-box flow-box--keys" x="30" y="126" width="200" height="42" rx="4" ry="4" />
            <text class="flow-text" x="130" y="146" text-anchor="middle">Restormel Keys</text>
            <text class="flow-sub flow-sub--on-keys" x="130" y="160" text-anchor="middle">resolve · fallbacks · keys</text>
            <line class="flow-connector flow-connector--keys" x1="130" y1="172" x2="130" y2="182" />
            <polygon class="flow-arrowhead flow-arrowhead--keys" points="130,190 126,182 134,182" />
            <rect class="flow-box" x="30" y="190" width="200" height="34" rx="4" ry="4" />
            <text class="flow-text" x="130" y="208" text-anchor="middle">Model providers</text>
            <text class="flow-sub" x="130" y="220" text-anchor="middle">gateway · extraction</text>
          </svg>
        </div>
      </figure>
      <div class="case-split">
        <div>
          <h3 class="case-h3">What Keys handles here</h3>
          <ul class="case-ul">
            <li>Policy evaluate → chosen extraction route.</li>
            <li>Automatic fallback when the primary model call fails.</li>
            <li>Server-only gateway and control-plane credentials.</li>
          </ul>
        </div>
        <div class="case-lesson">
          <h3 class="case-h3">Reusable lesson</h3>
          <p>
            High-trust workflows benefit when routing and recovery are <strong>product configuration</strong>, not a growing pile of <code class="inline-code">if</code>
            statements next to business logic.
          </p>
        </div>
      </div>
      <blockquote class="case-quote plot-quote">
        <p>
          “We use Restormel Keys to keep model routing and fallback logic out of brittle app code. It gives us safer, policy-driven control for
          sensitive household document workflows.”
        </p>
        <footer>— Plotbudget team</footer>
      </blockquote>
      <p class="case-links">
        <a href="https://plotbudget.com" target="_blank" rel="noopener noreferrer">plotbudget.com</a>
        <span aria-hidden="true"> · </span>
        <a href="https://app.plotbudget.com" target="_blank" rel="noopener noreferrer">app.plotbudget.com</a>
      </p>
      <p class="case-footnote">
        Adoption note: docs + Restormel MCP in Cursor yielded a working routing/policy loop in one focused session (~30 minutes; your environment may
        differ).
      </p>
    </section>

    <!-- 5b. Sophia — complexity / combined mode proof -->
    <section id="sophia" class="case-sophia" aria-labelledby="sophia-title">
      <div class="sophia-band">
        <p class="case-label">Case · complexity &amp; combined mode</p>
        <h2 id="sophia-title" class="case-name">Sophia — structured analysis &amp; multi-pass reasoning</h2>
        <p class="case-one-liner">SvelteKit app: interactive analysis, ingestion pipelines, user BYOK, and operator surfaces—one control plane.</p>
      </div>
      <dl class="case-meta sophia-meta">
        <div>
          <dt>Environment</dt>
          <dd>Multiple server routes (analyse, allowed-models, ingestion admin, beta AAIF).</dd>
        </div>
        <div>
          <dt>Constraints</dt>
          <dd>Multi-stage workloads, operator tuning, picker truth vs policy, combined builder + user keys.</dd>
        </div>
        <div>
          <dt>Why Keys fit</dt>
          <dd>One resolve and policy story across product and admin paths; allowlists that match real permissions.</dd>
        </div>
      </dl>
      <p class="case-narrative">
        Sophia is a deeper architecture, so the overall product took longer to build. Keys removed the worst part: bespoke routing and BYOK glue.
        Analysis, model availability, ingestion routing, and constrained beta APIs share the same Dashboard API and resolve patterns validated in smoke
        tests—so “how we configured it” and “what ran” stay aligned.
      </p>
      <figure class="case-flow case-flow--sophia" aria-labelledby="sophia-flow-caption">
        <figcaption id="sophia-flow-caption" class="case-flow-caption">
          Simplified flow: multiple SvelteKit server routes share one Keys layer for resolve and policy, then reach platform keys, user BYOK, and
          providers—without duplicating routing logic per path.
        </figcaption>
        <div class="flow-diagram flow-diagram--fanin" aria-hidden="true">
          <svg viewBox="0 0 340 216" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" focusable="false">
            <rect class="flow-box" x="70" y="4" width="200" height="32" rx="4" ry="4" />
            <text class="flow-text" x="170" y="20" text-anchor="middle">Product &amp; admin UI</text>
            <text class="flow-sub" x="170" y="30" text-anchor="middle">pickers · ops surfaces</text>
            <line class="flow-connector" x1="170" y1="36" x2="170" y2="44" />
            <line class="flow-connector" x1="60" y1="44" x2="280" y2="44" />
            <line class="flow-connector" x1="60" y1="44" x2="60" y2="52" />
            <line class="flow-connector" x1="170" y1="44" x2="170" y2="52" />
            <line class="flow-connector" x1="280" y1="44" x2="280" y2="52" />
            <rect class="flow-box" x="12" y="52" width="96" height="30" rx="4" ry="4" />
            <text class="flow-text" x="60" y="70" text-anchor="middle">Analyse</text>
            <rect class="flow-box" x="122" y="52" width="96" height="30" rx="4" ry="4" />
            <text class="flow-text flow-text--tight" x="170" y="70" text-anchor="middle">Allowed-models</text>
            <rect class="flow-box" x="232" y="52" width="96" height="30" rx="4" ry="4" />
            <text class="flow-text" x="280" y="68" text-anchor="middle">Ingestion</text>
            <text class="flow-sub" x="280" y="78" text-anchor="middle">admin</text>
            <line class="flow-connector" x1="60" y1="82" x2="60" y2="88" />
            <line class="flow-connector" x1="170" y1="82" x2="170" y2="88" />
            <line class="flow-connector" x1="280" y1="82" x2="280" y2="88" />
            <line class="flow-connector" x1="60" y1="88" x2="280" y2="88" />
            <line class="flow-connector" x1="170" y1="88" x2="170" y2="96" />
            <polygon class="flow-arrowhead" points="170,104 166,96 174,96" />
            <rect class="flow-box flow-box--keys" x="50" y="104" width="240" height="40" rx="4" ry="4" />
            <text class="flow-text" x="170" y="124" text-anchor="middle">Restormel Keys</text>
            <text class="flow-sub flow-sub--on-keys" x="170" y="136" text-anchor="middle">shared resolve · policy · allowlists</text>
            <line class="flow-connector flow-connector--keys" x1="170" y1="146" x2="170" y2="154" />
            <polygon class="flow-arrowhead flow-arrowhead--keys" points="170,162 166,154 174,154" />
            <rect class="flow-box" x="50" y="162" width="240" height="30" rx="4" ry="4" />
            <text class="flow-text" x="170" y="182" text-anchor="middle">Platform keys · user BYOK · providers</text>
          </svg>
        </div>
      </figure>
      <div class="case-split sophia-split">
        <div>
          <h3 class="case-h3">What Keys handles here</h3>
          <ul class="case-ul">
            <li>Resolve across analysis and ingestion workloads.</li>
            <li>Policy evaluation before expensive work; operator-clear errors when blocked.</li>
            <li>Allowed-models merges BYOK availability with live project allowlists.</li>
          </ul>
        </div>
        <div class="case-lesson sophia-lesson">
          <h3 class="case-h3">Reusable lesson</h3>
          <p>
            When the product has many surfaces, <strong>shared primitives beat parallel integrations</strong>—otherwise ops and runtime diverge and
            every new feature reimplements the same guard rails.
          </p>
        </div>
      </div>
      <p class="case-links">
        <a href="https://usesophia.app" target="_blank" rel="noopener noreferrer">usesophia.app</a>
        <span aria-hidden="true"> · </span>
        <a href="https://docs.usesophia.app" target="_blank" rel="noopener noreferrer">docs.usesophia.app</a>
      </p>
    </section>

    <!-- 6. Patterns grid -->
    <section id="patterns" class="patterns-ledger" aria-labelledby="patterns-heading">
      <div class="patterns-head">
        <h2 id="patterns-heading" class="patterns-title">Patterns to take back to your codebase</h2>
        <p>
          These are the decisions teams usually reimplement badly. Keys encodes them as product behavior—so you ship features instead of another
          internal “model router v3.”
        </p>
      </div>
      <div class="patterns-grid">
        {#each patternCards as card}
          <article class="pattern-tile">
            <h3 class="pattern-name">{card.name}</h3>
            <p class="pattern-body">{card.body}</p>
            <p class="pattern-prevent"><span>Prevents</span> {card.prevents}</p>
          </article>
        {/each}
      </div>
    </section>

    <!-- 7. CTA -->
    <section id="build-your-own" class="cta-final" aria-labelledby="cta-heading">
      <h2 id="cta-heading" class="cta-title">Take away the layer, not the story</h2>
      <p class="cta-lede">
        You should leave this page understanding what to <strong>stop hand-rolling</strong>: routing tables in handlers, one-off retries, picker
        drift, and BYOK edge cases. Keys installs as a library, configures in the dashboard, and scales with your app—<strong>without</strong> making
        Restormel a mandatory traffic proxy.
      </p>
      <div class="cta-actions">
        <a href="/keys/dashboard/login" class="btn btn-primary">Start free</a>
        <a href="/keys/docs/walkthrough" class="btn btn-secondary">Walkthrough</a>
        <a href="/keys/docs" class="btn btn-secondary">All docs</a>
      </div>
    </section>
  </div>
</article>

<style>
  .use-cases-page .container {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding: 0 var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
  }

  /* Hero: asymmetric ledger */
  .hero-ledger {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    gap: var(--space-8);
    align-items: start;
    padding-bottom: var(--space-8);
    border-bottom: 1px solid var(--rm-border);
  }
  .hero-eyebrow {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--rm-dim);
    font-weight: var(--font-semibold);
  }
  .hero-title {
    margin: 0 0 var(--space-4);
    font-family: var(--rm-font-display);
    font-size: clamp(2.1rem, 5vw, 3.25rem);
    line-height: 1.08;
    color: var(--rm-text);
    max-width: 18ch;
  }
  .hero-subhead {
    margin: 0 0 var(--space-3);
    font-size: var(--text-lg);
    color: var(--rm-muted);
    max-width: 42ch;
    line-height: var(--leading-relaxed);
  }
  .hero-point {
    margin: 0 0 var(--space-5);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    max-width: 48ch;
    line-height: var(--leading-relaxed);
  }
  .hero-point :global(strong) {
    color: var(--rm-text);
  }
  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .hero-panels {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-2);
  }
  .hero-panel {
    padding: var(--space-5);
    border-left: 3px solid var(--rm-sage);
    background: var(--rm-surface-raised);
    border-radius: 0 var(--rm-radius) var(--rm-radius) 0;
  }
  .hero-panel-title {
    margin: 0 0 var(--space-2);
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    letter-spacing: 0.02em;
  }
  .hero-panel-body {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }

  /* Framing: intro rail + mode cards */
  .framing {
    display: grid;
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
    gap: var(--space-8);
    align-items: start;
  }
  .framing-intro {
    padding-right: var(--space-4);
    border-right: 1px solid var(--rm-border);
  }
  .framing-title {
    margin: 0 0 var(--space-3);
    font-family: var(--rm-font-display);
    font-size: clamp(1.6rem, 3vw, 2.1rem);
    color: var(--rm-text);
  }
  .framing-intro p {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .framing-intro :global(strong) {
    color: var(--rm-text);
  }
  .framing-muted {
    margin: 0 !important;
    font-size: var(--text-xs) !important;
    color: var(--rm-dim) !important;
  }
  .mode-rail {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .mode-card {
    padding: var(--space-5);
    background: var(--rm-bg);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
  }
  .mode-name {
    margin: 0 0 var(--space-2);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
  }
  .mode-line {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .mode-when {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: 1.5;
    padding-top: var(--space-3);
    border-top: 1px solid var(--rm-border);
  }
  .mode-when-label {
    display: block;
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin-bottom: var(--space-1);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-size: 0.65rem;
  }

  /* Primitives: typographic grid, not boxed cards */
  .primitives-block {
    padding: var(--space-6) 0;
    border-top: 1px solid var(--rm-border);
    border-bottom: 1px solid var(--rm-border);
  }
  .primitives-header {
    max-width: 52ch;
    margin-bottom: var(--space-5);
  }
  .primitives-title {
    margin: 0 0 var(--space-2);
    font-family: var(--rm-font-display);
    font-size: clamp(1.5rem, 2.8vw, 1.85rem);
    color: var(--rm-text);
  }
  .primitives-lede {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .primitive-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0;
  }
  .primitive-item {
    display: grid;
    grid-template-columns: 8rem minmax(0, 1fr);
    gap: var(--space-4);
    padding: var(--space-3) var(--space-2);
    border-bottom: 1px solid color-mix(in oklab, var(--rm-border) 80%, transparent);
    align-items: baseline;
  }
  .primitive-item:nth-child(odd) {
    padding-right: var(--space-6);
  }
  @media (min-width: 981px) {
    .primitive-item:nth-last-child(-n + 2) {
      border-bottom: none;
    }
  }
  .primitive-name {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-sage);
  }
  .primitive-detail {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }

  /* Operating model */
  .operating {
    max-width: 48rem;
  }
  .operating-title {
    margin: 0 0 var(--space-2);
    font-family: var(--rm-font-display);
    font-size: clamp(1.5rem, 2.8vw, 1.9rem);
    color: var(--rm-text);
  }
  .operating-lede {
    margin: 0 0 var(--space-5);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .operating-lede :global(strong) {
    color: var(--rm-text);
  }

  /* Inline flow diagrams (--rm-* only; see .cursor/skills/restormel-product-flow-diagrams) */
  .flow-diagram {
    margin: var(--space-4) 0 var(--space-5);
    width: 100%;
  }
  .flow-diagram--horizontal {
    margin-top: var(--space-3);
    max-width: 52rem;
  }
  .flow-diagram svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .flow-diagram--vertical {
    max-width: 20rem;
  }
  .flow-diagram--fanin {
    max-width: 26rem;
  }
  .flow-diagram svg :global(.flow-box) {
    fill: var(--rm-surface-raised);
    stroke: var(--rm-border);
    stroke-width: 1;
  }
  .flow-diagram svg :global(.flow-box--keys) {
    fill: color-mix(in oklab, var(--rm-sage) 14%, var(--rm-surface));
    stroke: var(--rm-sage);
    stroke-width: 1.25;
  }
  .flow-diagram svg :global(.flow-text) {
    font-family: var(--rm-font-ui);
    font-size: 10px;
    fill: var(--rm-text);
  }
  .flow-diagram svg :global(.flow-text--tight) {
    font-size: 8.5px;
  }
  .flow-diagram svg :global(.flow-sub) {
    font-family: var(--rm-font-ui);
    font-size: 7.5px;
    fill: var(--rm-muted);
  }
  .flow-diagram svg :global(.flow-sub--on-keys) {
    fill: color-mix(in oklab, var(--rm-muted) 70%, var(--rm-sage));
  }
  .flow-diagram svg :global(.flow-connector) {
    stroke: var(--rm-border);
    stroke-width: 1;
    fill: none;
  }
  .flow-diagram svg :global(.flow-connector--keys) {
    stroke: var(--rm-sage);
  }
  .flow-diagram svg :global(.flow-arrowhead) {
    fill: var(--rm-border);
    stroke: none;
  }
  .flow-diagram svg :global(.flow-arrowhead--keys) {
    fill: var(--rm-sage);
  }

  .case-flow {
    margin: var(--space-5) 0 var(--space-5);
  }
  .case-flow-caption {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: var(--leading-relaxed);
    max-width: 52ch;
  }
  .case-flow--sophia .case-flow-caption {
    max-width: 58ch;
  }

  .operating-stack {
    list-style: none;
    margin: 0;
    padding: 0;
    counter-reset: op;
  }
  .operating-row {
    display: grid;
    grid-template-columns: 2.5rem 1fr;
    gap: var(--space-3);
    padding: var(--space-4) 0;
    border-bottom: 1px solid var(--rm-border);
    align-items: start;
  }
  .operating-row:last-child {
    border-bottom: none;
  }
  .operating-index {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-dim);
    line-height: 1.4;
  }
  .operating-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .operating-label {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
  }
  .operating-note {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }

  /* Verified context block */
  .verified-block {
    padding: var(--space-7) var(--space-6);
    border: 2px solid var(--brut-ink, #0C0C0C);
    border-left-width: 6px;
    border-left-color: var(--brut-yellow, #F5C518);
    background: var(--brut-white, #fff);
    box-shadow: 4px 4px 0 var(--brut-ink, #0C0C0C);
  }
  .verified-proof-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
    margin: var(--space-5) 0 var(--space-3);
    padding: var(--space-4) 0;
    border-top: 1px solid var(--rm-border);
    border-bottom: 1px solid var(--rm-border);
  }
  .verified-stat-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .verified-stat {
    font-family: var(--brut-font, var(--rm-font-display));
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 900;
    line-height: 1;
    color: var(--brut-ink, #0C0C0C);
  }
  .verified-stat-label {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    color: var(--rm-muted);
    line-height: 1.4;
  }
  .verified-stat-meta {
    display: block;
    font-size: 0.9em;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: var(--rm-dim);
    margin-top: 2px;
  }
  .verified-ledger-note {
    margin: 0 0 var(--space-5);
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: 1.5;
  }
  .verified-ledger-note a {
    color: var(--brut-blue, var(--rm-sage));
    font-weight: 600;
  }
  .verified-meta {
    margin-bottom: var(--space-5);
  }
  .verified-industries {
    margin-top: var(--space-5);
    padding-top: var(--space-5);
    border-top: 1px solid var(--rm-border);
  }
  .verified-industry-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
    margin-top: var(--space-3);
  }
  .verified-industry-card {
    padding: var(--space-4);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
  }
  .verified-industry-tag {
    display: inline-block;
    margin-bottom: var(--space-2);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-ink, #0C0C0C);
  }
  .verified-industry-card p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.55;
  }

  /* PLOT: left-accent document */
  .case-plot {
    padding: var(--space-7) var(--space-6);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
    border-left-width: 4px;
    border-left-color: var(--rm-sage);
  }
  .case-label {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--rm-dim);
    font-weight: var(--font-semibold);
  }
  .case-name {
    margin: 0 0 var(--space-2);
    font-family: var(--rm-font-display);
    font-size: clamp(1.45rem, 3vw, 1.85rem);
    color: var(--rm-text);
  }
  .case-one-liner {
    margin: 0 0 var(--space-4);
    font-size: var(--text-base);
    color: var(--rm-muted);
    max-width: 52ch;
  }
  .case-meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
    margin: 0 0 var(--space-5);
    padding: var(--space-4) 0;
    border-top: 1px solid var(--rm-border);
    border-bottom: 1px solid var(--rm-border);
  }
  .case-meta dt {
    font-size: var(--text-xs);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--rm-dim);
    margin: 0 0 var(--space-1);
  }
  .case-meta dd {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .case-narrative {
    margin: 0 0 var(--space-5);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    max-width: 62ch;
  }
  .inline-code {
    font-family: var(--rm-font-ui);
    font-size: 0.9em;
    padding: 0.1em 0.35em;
    border-radius: calc(var(--rm-radius) - 2px);
    background: color-mix(in oklab, var(--rm-surface-raised) 85%, var(--rm-border));
  }
  .case-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
    margin-bottom: var(--space-5);
  }
  .case-h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
  }
  .case-ul {
    margin: 0;
    padding-left: 1.15rem;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.55;
  }
  .case-ul li + li {
    margin-top: var(--space-2);
  }
  .case-lesson {
    padding: var(--space-4);
    background: var(--rm-bg);
    border-radius: var(--rm-radius);
    border: 1px dashed color-mix(in oklab, var(--rm-border) 70%, var(--rm-sage));
  }
  .case-lesson p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .case-lesson :global(strong) {
    color: var(--rm-text);
  }
  .plot-quote {
    margin: 0 0 var(--space-4);
    padding: 0;
    border: none;
    background: transparent;
  }
  .plot-quote p {
    margin: 0 0 var(--space-2);
    font-size: var(--text-base);
    font-family: var(--rm-font-display);
    font-style: italic;
    color: var(--rm-text);
    line-height: var(--leading-relaxed);
  }
  .plot-quote footer {
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .case-links {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
  }
  .case-footnote {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    max-width: 56ch;
  }

  /* Sophia: band + open layout */
  .case-sophia {
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--rm-surface);
  }
  .sophia-band {
    padding: var(--space-6) var(--space-6) var(--space-5);
    background: color-mix(in oklab, var(--rm-surface-raised) 88%, var(--rm-bg));
    border-bottom: 1px solid var(--rm-border);
  }
  .sophia-meta {
    margin: 0;
    padding: var(--space-5) var(--space-6);
    border: none;
    border-bottom: 1px solid var(--rm-border);
    background: var(--rm-surface);
  }
  .case-sophia .case-narrative {
    padding: 0 var(--space-6);
    margin-top: var(--space-5);
    margin-bottom: var(--space-5);
  }
  .sophia-split {
    padding: 0 var(--space-6) var(--space-6);
  }
  .sophia-lesson {
    border-style: solid;
    border-color: var(--rm-border);
  }
  .case-sophia .case-links {
    padding: 0 var(--space-6) var(--space-6);
    margin: 0;
  }

  /* Patterns: high-signal ledger */
  .patterns-ledger {
    padding: var(--space-7) var(--space-6);
    background: var(--rm-bg);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
  }
  .patterns-head {
    max-width: 48ch;
    margin-bottom: var(--space-6);
  }
  .patterns-title {
    margin: 0 0 var(--space-2);
    font-family: var(--rm-font-display);
    font-size: clamp(1.55rem, 3vw, 2rem);
    color: var(--rm-text);
  }
  .patterns-head p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .patterns-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
  }
  .pattern-tile {
    padding: var(--space-5);
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-height: 100%;
  }
  .pattern-name {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
  }
  .pattern-body {
    margin: 0;
    flex: 1;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .pattern-prevent {
    margin: 0;
    padding-top: var(--space-3);
    border-top: 1px solid var(--rm-border);
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: 1.5;
  }
  .pattern-prevent span {
    display: block;
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin-bottom: var(--space-1);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-size: 0.65rem;
  }

  /* CTA */
  .cta-final {
    padding: var(--space-8) var(--space-6);
    text-align: center;
    border: 1px solid color-mix(in oklab, var(--rm-sage) 35%, var(--rm-border));
    border-radius: var(--radius-md);
    background: linear-gradient(
      180deg,
      color-mix(in oklab, var(--rm-sage) 8%, var(--rm-surface)) 0%,
      var(--rm-surface) 100%
    );
  }
  .cta-title {
    margin: 0 auto var(--space-3);
    max-width: 22ch;
    font-family: var(--rm-font-display);
    font-size: clamp(1.5rem, 3.2vw, 2rem);
    color: var(--rm-text);
  }
  .cta-lede {
    margin: 0 auto var(--space-5);
    max-width: 52ch;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    text-align: left;
  }
  .cta-lede :global(strong) {
    color: var(--rm-text);
  }
  .cta-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    justify-content: center;
  }

  @media (max-width: 980px) {
    .verified-proof-strip {
      grid-template-columns: 1fr 1fr;
    }
    .verified-industry-grid {
      grid-template-columns: 1fr;
    }
    .hero-ledger {
      grid-template-columns: 1fr;
      gap: var(--space-6);
    }
    .hero-title {
      max-width: none;
    }
    .framing {
      grid-template-columns: 1fr;
      gap: var(--space-6);
    }
    .framing-intro {
      padding-right: 0;
      border-right: none;
      padding-bottom: var(--space-5);
      border-bottom: 1px solid var(--rm-border);
    }
    .primitive-list {
      grid-template-columns: 1fr;
    }
    .primitive-item {
      grid-template-columns: 1fr;
      gap: var(--space-1);
      padding: var(--space-3) 0;
    }
    .primitive-item:nth-child(odd) {
      padding-right: 0;
    }
    .primitive-item {
      border-bottom: 1px solid color-mix(in oklab, var(--rm-border) 80%, transparent);
    }
    .case-meta {
      grid-template-columns: 1fr;
    }
    .case-split {
      grid-template-columns: 1fr;
    }
    .patterns-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .use-cases-page .container {
      padding: 0 var(--space-4);
      gap: var(--space-8);
    }
    .verified-proof-strip {
      grid-template-columns: 1fr;
    }
    .verified-block {
      padding: var(--space-5) var(--space-4);
    }
    .case-plot {
      padding: var(--space-5) var(--space-4);
    }
    .patterns-ledger {
      padding: var(--space-5) var(--space-4);
    }
    .cta-final {
      padding: var(--space-6) var(--space-4);
    }
    .cta-lede {
      text-align: left;
    }
  }
</style>
