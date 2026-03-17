<script lang="ts">
  /** Restormel Keys landing — migrated from Astro (Phase B). Code samples use vars so bundler does not resolve workspace packages. */
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";

  const pkgKeys = "@restormel/keys";
  const pkgReact = "@restormel/keys-react";
  const serverCode = `// app/api/chat/route.ts (Next.js App Router)
import { createResolveMiddleware } from "${pkgKeys}";

const resolve = createResolveMiddleware({
  keys: await getStoredKeys(),
  providers: ["openai", "anthropic"],
});

export async function POST(req: Request) {
  const { model, messages } = await req.json();
  const { provider, apiKey } = await resolve(model);
  const res = await fetch(provider.chatUrl, {
    method: "POST",
    headers: { "Authorization": \`Bearer \${apiKey}\` },
    body: JSON.stringify({ model, messages }),
  });
  return Response.json(await res.json());
}`;

  const uiCode = `// app/settings/page.tsx
import { KeyManager } from "${pkgReact}";

export default function Settings() {
  return (
    <KeyManager
      keys={keys}
      onKeyAdded={handleAdd}
      userId={user.id}
    />
  );
}`;
</script>

<svelte:head>
  <title>Restormel Keys — BYOK for AI apps</title>
  <meta name="description" content="Drop-in BYOK for AI apps. Ship key management in your existing stack — Next.js, React, SvelteKit, Web Components. No Docker, no proxy server." />
</svelte:head>

<article class="keys-page">
  <section class="section section-hero" aria-labelledby="hero-heading">
    <div class="container">
      <h1 id="hero-heading" class="hero-headline">Drop-in BYOK for AI apps.</h1>
      <p class="hero-subhead">
        Multi-provider routing and production-grade key management inside your app. One interface; your stack. Ship it in an afternoon.
      </p>
      <p class="hero-who">For AI SaaS builders, open-source maintainers, and small teams that need routing and end-user BYOK without running a gateway or rewriting key logic from scratch.</p>
      <div class="hero-ctas">
        <a href="/keys/docs/walkthrough/phase-0-inventory" class="btn btn-primary btn-cta-hero">Start the walkthrough</a>
        <a href="/keys/docs" class="btn btn-secondary">Docs</a>
        <a href="https://github.com/Allotment-Technology-Ltd/restormel-keys" class="btn btn-secondary" target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
    </div>
  </section>

  <section class="section section-alt" aria-labelledby="why-heading">
    <div class="container container-narrow">
      <h2 id="why-heading" class="section-title">Why Keys exists</h2>
      <p class="section-intro">Every AI app eventually needs two things: <strong>multi-provider routing</strong> (OpenAI, Anthropic, Google through one interface, with cost tracking and fallbacks) and <strong>end-user BYOK</strong> (let your users bring their own keys so you're not on the hook for their usage). Today you get LiteLLM (Docker, Postgres, Redis) or Portkey (gateway-first, enterprise pricing) — or you build it yourself. Keys is the library that does both: routing and key management you embed in your app, with optional embeddable UI. No proxy by default.</p>
    </div>
  </section>

  <section class="section section-modes" aria-labelledby="modes-heading">
    <div class="container">
      <h2 id="modes-heading" class="section-title">Three ways to use it</h2>
      <p class="section-intro">Builder routing, end-user BYOK, or both. Same core; you choose what you expose.</p>
      <div class="modes-grid">
        <div class="mode-card">
          <h3 class="mode-title">Builder routing</h3>
          <p class="mode-copy">Your server resolves model → provider and API key. One middleware, any provider. Cost estimation and tracking built in. For SaaS backends and internal tools.</p>
        </div>
        <div class="mode-card">
          <h3 class="mode-title">End-user BYOK</h3>
          <p class="mode-copy">Your users add their own keys. Your app stores them securely and routes requests with per-user limits. Their usage, their keys — you control routing and entitlements.</p>
        </div>
        <div class="mode-card">
          <h3 class="mode-title">Combined</h3>
          <p class="mode-copy">Platform keys for core features; user keys for premium or heavy usage. One routing, cost, and entitlement layer.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-code section-alt" aria-labelledby="code-heading">
    <div class="container">
      <h2 id="code-heading" class="section-title">Add it to your stack</h2>
      <p class="section-intro">Next.js App Router: one route handler and a settings page. No Docker, Redis, or proxy.</p>
      <div class="code-split">
        <div class="code-pane">
          <span class="code-label">Server</span>
          <CodeBlock language="ts" code={serverCode} />
        </div>
        <div class="code-pane">
          <span class="code-label">React / Next.js</span>
          <CodeBlock language="tsx" code={uiCode} />
        </div>
      </div>
    </div>
  </section>

  <section class="section section-frameworks" aria-labelledby="frameworks-heading">
    <div class="container">
      <h2 id="frameworks-heading" class="section-title">Fits your framework</h2>
      <p class="frameworks-copy">
        <strong>Next.js</strong> App Router is the primary path. <strong>React</strong>: wrapper components plus hooks. <strong>SvelteKit</strong>: native Svelte 5 components. <strong>Web Components</strong> for Astro, vanilla HTML, or any framework. Same API; no Docker, Redis, or proxy.
      </p>
      <ul class="framework-list" aria-label="Supported frameworks">
        <li><span class="fw-pill">Next.js</span></li>
        <li><span class="fw-pill">React</span></li>
        <li><span class="fw-pill">SvelteKit</span></li>
        <li><span class="fw-pill">Vue</span></li>
        <li><span class="fw-pill">Astro</span></li>
      </ul>
    </div>
  </section>

  <section class="section section-features section-alt" aria-labelledby="features-heading">
    <div class="container">
      <h2 id="features-heading" class="section-title">What's in the box</h2>
      <p class="section-intro">Routing, key management, cost, entitlements, and embeddable UI. One library.</p>
      <div class="features-grid">
        <div class="feature-card"><h3 class="feature-title">Key management</h3><p>Add, validate, list, delete. Keys masked in UI and logs.</p></div>
        <div class="feature-card"><h3 class="feature-title">Routing</h3><p>Model → provider resolution. One middleware, multiple backends.</p></div>
        <div class="feature-card"><h3 class="feature-title">Cost</h3><p>Per-model cost and budget comparison. Estimate before you call.</p></div>
        <div class="feature-card"><h3 class="feature-title">Entitlements</h3><p>Gate features by tier. Optional usage limits.</p></div>
        <div class="feature-card"><h3 class="feature-title">Embeddable UI</h3><p>KeyManager, ModelSelector, CostEstimator. Svelte, React, or Web Components.</p></div>
        <div class="feature-card"><h3 class="feature-title">Storage adapters</h3><p>In-memory, encrypted local file, or plug in Firestore, Supabase, Postgres.</p></div>
      </div>
    </div>
  </section>

  <section class="section section-pricing section-alt" aria-labelledby="pricing-heading">
    <div class="container">
      <h2 id="pricing-heading" class="section-title">Pricing</h2>
      <p class="section-intro">The core is open source. Pay for cloud API, dashboard, and team features when you need them.</p>
      <div class="pricing-grid">
        <div class="pricing-card">
          <h3 class="pricing-tier">Free</h3>
          <p class="pricing-price">£0</p>
          <p class="pricing-desc">Open source. Self-host. Memory + local storage. No Paddle.</p>
        </div>
        <div class="pricing-card">
          <h3 class="pricing-tier">Pro</h3>
          <p class="pricing-price">£19<span class="pricing-period">/mo</span></p>
          <p class="pricing-desc">Cloud API, dashboard. 1K keys, 100K requests/mo.</p>
        </div>
        <div class="pricing-card">
          <h3 class="pricing-tier">Team</h3>
          <p class="pricing-price">£49<span class="pricing-period">/mo</span></p>
          <p class="pricing-desc">Unlimited users, 10K keys. Usage dashboard, team sharing, audit log.</p>
        </div>
        <div class="pricing-card">
          <h3 class="pricing-tier">Enterprise</h3>
          <p class="pricing-price">£149<span class="pricing-period">/mo</span></p>
          <p class="pricing-desc">Unlimited keys & API. SSO, SLA, export. Zuplo gateway + custom.</p>
        </div>
      </div>
      <p class="pricing-cta"><a href="/keys/pricing">See full pricing and FAQ →</a></p>
    </div>
  </section>

  <section class="section section-cta" aria-labelledby="cta-heading">
    <div class="container">
      <h2 id="cta-heading" class="cta-headline">Add Keys to your app</h2>
      <p class="cta-sub">Install, wire your providers, add a settings page. Next.js and SvelteKit guides in the docs.</p>
      <a href="/keys/docs" class="btn btn-primary">Get started</a>
    </div>
  </section>
</article>

<style>
  .keys-page {
    --keys-max: var(--rm-container-max);
  }
  .container {
    max-width: var(--keys-max);
    margin: 0 auto;
    padding: 0 var(--space-6);
  }
  .container-narrow {
    max-width: var(--rm-container-narrow);
  }
  .section {
    padding: var(--rm-section-padding) 0;
  }
  .section-alt {
    background: var(--rm-surface);
  }
  .section-title {
    font-family: var(--rm-font-display);
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-6);
  }
  .section-intro {
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    max-width: var(--rm-container-narrow);
  }
  .section-hero {
    padding-top: var(--space-8);
    padding-bottom: var(--space-12);
  }
  .hero-headline {
    font-family: var(--rm-font-display);
    font-size: clamp(2.25rem, 6vw, 3.5rem);
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .hero-subhead {
    font-family: var(--rm-font-ui);
    font-size: var(--text-lg);
    color: var(--rm-muted);
    margin: 0 0 var(--space-2);
    max-width: 65ch;
    line-height: var(--leading-relaxed);
  }
  .hero-who {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    margin: 0 0 var(--space-8);
    max-width: 65ch;
  }
  .hero-ctas {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .btn {
    display: inline-block;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-5);
    min-height: var(--button-height-md);
    line-height: 1.25;
    border-radius: var(--rm-radius);
    text-decoration: none;
    font-weight: var(--font-medium);
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .btn-primary:hover {
    filter: brightness(1.1);
  }
  .btn-cta-hero {
    padding: var(--space-4) var(--space-8);
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    min-width: 16rem;
    text-align: center;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  }
  .btn-cta-hero:hover {
    filter: brightness(1.1);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }
  .btn-secondary {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    border: 1px solid var(--rm-border);
  }
  .btn-secondary:hover {
    border-color: var(--rm-sage);
    color: var(--rm-sage);
  }
  .modes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--space-6);
  }
  .mode-card {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-6);
  }
  .mode-title {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-sage);
    margin: 0 0 var(--space-2);
  }
  .mode-copy {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0;
    line-height: var(--leading-relaxed);
  }
  .code-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
  }
  @media (max-width: 768px) {
    .code-split {
      grid-template-columns: 1fr;
    }
  }
  .code-pane {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .code-label {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    color: var(--rm-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .frameworks-copy {
    font-size: var(--text-base);
    color: var(--rm-muted);
    margin: 0 0 var(--space-5);
    max-width: var(--rm-container-narrow);
  }
  .frameworks-copy :global(strong) {
    color: var(--rm-text);
  }
  .framework-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .fw-pill {
    display: inline-block;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-3);
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    color: var(--rm-muted);
  }
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-4);
  }
  .feature-card {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-5);
  }
  .feature-title {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-sage);
    margin: 0 0 var(--space-2);
  }
  .feature-card p {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0;
    line-height: var(--leading-relaxed);
  }
  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: var(--space-6);
    margin-bottom: var(--space-6);
  }
  .pricing-card {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-6);
  }
  .pricing-tier {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .pricing-price {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    color: var(--rm-sage);
    margin: 0 0 var(--space-1);
  }
  .pricing-period {
    font-size: var(--text-sm);
    color: var(--rm-dim);
  }
  .pricing-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0;
    line-height: var(--leading-relaxed);
  }
  .pricing-cta {
    margin: 0;
  }
  .cta-headline {
    font-family: var(--rm-font-display);
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .cta-sub {
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
  }
</style>
