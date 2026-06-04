<script lang="ts">
  /** Legacy props + `$:` — `runes: false` (see changelog/+page.svelte). */
  import { enhance } from "$app/forms";
  import type { ActionData, PageData } from "./$types";

  export let data: PageData;
  export let form: ActionData | undefined = undefined;

  const moduleOptions = [
    { value: "keys", label: "Restormel Keys" },
    { value: "testing", label: "Restormel Testing" },
    { value: "graph", label: "Restormel Graph" },
    { value: "connect", label: "Restormel Connect" },
    { value: "platform", label: "Full suite (Keys + Testing + Graph + Connect)" },
  ] as const;

  const defaultValues = {
    name: "",
    email: "",
    building: "",
    modules: [] as string[],
    stack: "",
    howFound: "",
    listed: "",
  };

  $: values =
    form && typeof form === "object" && "values" in form && form.values ? form.values : defaultValues;

  $: fieldErrors =
    form && typeof form === "object" && "errors" in form && form.errors
      ? (form.errors as Record<string, string>)
      : ({} as Record<string, string>);

  $: submitted = Boolean(form && typeof form === "object" && "success" in form && form.success === true);

  function moduleChecked(value: string): boolean {
    return values.modules?.includes(value) ?? false;
  }
</script>

<svelte:head>
  <title>Restormel Founders Circle — Request early access</title>
  <meta
    name="description"
    content="Restormel is invite-only while we prove product–market fit. Register your interest — we’ll email a personal access link when your cohort is approved."
  />
</svelte:head>

<article class="founders-page">
    <header class="founders-hero container">
      <p class="founders-kicker">Invite-only early access</p>
      <h1 class="founders-hero-title">Restormel Founders Circle</h1>
      <p class="founders-hero-sub">
        We’re not selling subscriptions yet. Join a small cohort of builders helping us shape the suite — then get a
        personal dashboard link when you’re approved.
      </p>
    </header>

    <section id="program" class="section-prose container" aria-labelledby="program-heading">
      <h2 id="program-heading" class="section-h2">How access works</h2>
      <ol class="access-steps">
        <li>
          <strong>Apply with your work email</strong> — tell us what you’re building and which modules matter.
        </li>
        <li>
          <strong>We review each request</strong> — dashboard access is manual so we can support you properly.
        </li>
        <li>
          <strong>We email your access link</strong> — sign in when invited; no card, no checkout, no surprise paywall.
        </li>
      </ol>
      <p class="prose">
        Public docs, open-source libraries, and marketing pages stay open. The <strong>hosted dashboard and suite hubs</strong>
        are for approved founders while we validate that Restormel solves real production problems.
      </p>
    </section>

    <section class="section-alt" aria-labelledby="benefits-heading">
      <div class="container">
        <h2 id="benefits-heading" class="section-h2 section-h2-center">What Founders get</h2>
        <ul class="benefits-grid">
          <li class="benefit-card">
            <h3 class="benefit-title">Full suite access</h3>
            <p class="benefit-text">Keys, Testing, Graph, and Connect in one workspace — route models, assure quality, visualise graphs, and stand up agent knowledge infrastructure.</p>
          </li>
          <li class="benefit-card">
            <h3 class="benefit-title">Roadmap influence</h3>
            <p class="benefit-text">Your use cases steer what we ship next — before it hits the public changelog.</p>
          </li>
          <li class="benefit-card">
            <h3 class="benefit-title">Direct line to the team</h3>
            <p class="benefit-text">Short feedback loops while the product is still malleable — not a ticket queue.</p>
          </li>
          <li class="benefit-card">
            <h3 class="benefit-title">No commercial pressure</h3>
            <p class="benefit-text">Early access is free while we learn. Pricing comes later, with founders consulted first.</p>
          </li>
        </ul>
      </div>
    </section>

    <section class="section-ask container" aria-labelledby="ask-heading">
      <h2 id="ask-heading" class="section-h2">What we ask in return</h2>
      <p class="prose intro-ask">
        We’re asking for a fair exchange: real usage and honest feedback while the product is still forming.
      </p>
      <ol class="ask-list">
        <li>
          <strong>Try it on something real</strong> — a route, a test goal, a graph, or a Connect ingest — not a hello-world only.
        </li>
        <li>
          <strong>One structured feedback session</strong> — async or live; what worked, what blocked you, what you’d pay for.
        </li>
        <li>
          <strong>Optional public signal</strong> — star the repo, a short post, or a logo on our site if you’re comfortable.
        </li>
      </ol>
    </section>

    <section class="section-form section-alt" aria-labelledby="apply-heading">
      <div class="container form-wrap">
        <h2 id="apply-heading" class="section-h2">Request access</h2>
        <p class="form-intro">
          Use the email where you want your invite. We’ll reply with next steps — usually within a few business days.
        </p>

        {#if submitted}
          <div class="form-success" role="status">
            <h3 class="form-success-title">You’re on the list</h3>
            <p class="form-success-copy">
              Thanks — we’ve received your request. If you’re a fit for the current cohort, we’ll email you a personal
              sign-in link. Until then, browse the <a href="/docs">suite docs</a> and module overviews.
            </p>
            <p class="form-success-copy">
              <a href="/">Back to home</a>
              ·
              <a href="/docs">Documentation</a>
            </p>
          </div>
        {:else}
          {#if fieldErrors._form}
            <p class="form-error-banner" role="alert">{fieldErrors._form}</p>
          {/if}

          <form class="founders-form" method="POST" use:enhance>
            <div class="field">
              <label class="label" for="name">Name <span class="req" aria-hidden="true">*</span></label>
              <input
                id="name"
                name="name"
                type="text"
                autocomplete="name"
                required
                class="input"
                class:input-invalid={fieldErrors.name}
                value={values.name}
                aria-invalid={fieldErrors.name ? "true" : undefined}
                aria-describedby={fieldErrors.name ? "name-error" : undefined}
              />
              {#if fieldErrors.name}<span id="name-error" class="field-error">{fieldErrors.name}</span>{/if}
            </div>

            <div class="field">
              <label class="label" for="email">Email <span class="req" aria-hidden="true">*</span></label>
              <input
                id="email"
                name="email"
                type="email"
                autocomplete="email"
                required
                class="input"
                class:input-invalid={fieldErrors.email}
                value={values.email}
                aria-invalid={fieldErrors.email ? "true" : undefined}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
              {#if fieldErrors.email}<span id="email-error" class="field-error">{fieldErrors.email}</span>{/if}
            </div>

            <div class="field">
              <label class="label" for="building">What are you building? <span class="req" aria-hidden="true">*</span></label>
              <textarea
                id="building"
                name="building"
                required
                rows="5"
                class="input textarea"
                class:input-invalid={fieldErrors.building}
                aria-invalid={fieldErrors.building ? "true" : undefined}
                aria-describedby={fieldErrors.building ? "building-error" : undefined}
              >{values.building}</textarea>
              {#if fieldErrors.building}<span id="building-error" class="field-error">{fieldErrors.building}</span>{/if}
            </div>

            <fieldset class="field fieldset-mod">
              <legend class="label">
                Interested modules <span class="req" aria-hidden="true">*</span>
              </legend>
              <ul class="checkbox-list" role="list">
                {#each moduleOptions as m}
                  <li>
                    <label class="check-label">
                      <input type="checkbox" name="modules" value={m.value} checked={moduleChecked(m.value)} />
                      <span>{m.label}</span>
                    </label>
                  </li>
                {/each}
              </ul>
              {#if fieldErrors.modules}<span class="field-error" role="alert">{fieldErrors.modules}</span>{/if}
            </fieldset>

            <div class="field">
              <label class="label" for="stack">Stack <span class="optional">(optional)</span></label>
              <input
                id="stack"
                name="stack"
                type="text"
                class="input"
                placeholder="e.g. SvelteKit, Next.js, Python services"
                value={values.stack}
              />
            </div>

            <div class="field">
              <label class="label" for="howFound">How did you find Restormel? <span class="optional">(optional)</span></label>
              <input id="howFound" name="howFound" type="text" class="input" value={values.howFound} />
            </div>

            <fieldset class="field">
              <legend class="label">
                Okay to be listed on the founders page? <span class="req" aria-hidden="true">*</span>
              </legend>
              <div class="radio-row">
                <label class="check-label">
                  <input type="radio" name="listed" value="yes" checked={values.listed === "yes"} required />
                  <span>Yes</span>
                </label>
                <label class="check-label">
                  <input type="radio" name="listed" value="no" checked={values.listed === "no"} required />
                  <span>No</span>
                </label>
              </div>
              {#if fieldErrors.listed}<span class="field-error" role="alert">{fieldErrors.listed}</span>{/if}
            </fieldset>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary btn-submit">Request early access</button>
            </div>
            <p class="form-privacy">
              By submitting you agree we may email you about access and the program. We don’t sell your data. Dashboard
              sign-in is invite-only — we send links manually after review.
            </p>
          </form>
        {/if}
      </div>
    </section>

    <footer class="slots-footer container">
      <p class="slots-line">
        <!-- TODO: Wire slotsRemaining from database or admin config -->
        <strong>{data.slotsRemaining}</strong> / <strong>{data.slotsTotal}</strong> slots remaining
      </p>
    </footer>
  </article>

<style>
  .founders-page {
    padding-bottom: var(--space-12);
  }

  .container {
    max-width: var(--rm-container-narrow);
    margin: 0 auto;
    padding-left: var(--space-6);
    padding-right: var(--space-6);
  }

  .founders-hero {
    padding-top: var(--space-10);
    padding-bottom: var(--space-10);
    text-align: center;
    max-width: 40rem;
  }

  .founders-hero-title {
    font-family: var(--rm-font-display);
    font-size: clamp(var(--text-2xl), 4vw, var(--text-4xl));
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
    line-height: var(--leading-tight);
  }

  .founders-kicker {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }

  .access-steps {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }

  .access-steps li {
    margin-bottom: var(--space-3);
  }

  .access-steps strong {
    color: var(--rm-text);
  }

  .form-intro {
    margin: 0 0 var(--space-5);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }

  .founders-hero-sub {
    margin: 0;
    font-size: var(--text-lg);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }

  .section-h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
  }

  .section-h2-center {
    text-align: center;
    margin-bottom: var(--space-8);
  }

  .section-prose {
    padding-bottom: var(--space-10);
  }

  .prose {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
    max-width: var(--rm-reading-width);
  }

  .prose strong {
    color: var(--rm-text);
  }

  .section-alt {
    background: var(--rm-surface-2);
    border-top: 1px solid var(--rm-border);
    border-bottom: 1px solid var(--rm-border);
    padding: var(--space-10) 0;
  }

  .benefits-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-4);
    max-width: var(--rm-container-max);
    margin-left: auto;
    margin-right: auto;
  }

  .benefit-card {
    margin: 0;
    padding: var(--space-5);
    background: var(--rm-bg);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
  }

  .benefit-title {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-sage);
    margin: 0 0 var(--space-2);
  }

  .benefit-text {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }

  .section-ask {
    padding: var(--space-10) 0;
  }

  .intro-ask {
    margin-bottom: var(--space-4);
  }

  .ask-list {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    max-width: var(--rm-reading-width);
    margin: 0;
    padding-left: var(--space-6);
  }

  .ask-list li {
    margin-bottom: var(--space-3);
  }

  .ask-list strong {
    color: var(--rm-text);
  }

  .section-form {
    padding: var(--space-10) 0;
  }

  .form-wrap {
    max-width: 32rem;
  }

  .founders-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .fieldset-mod {
    border: 0;
    margin: 0;
    padding: 0;
  }

  .label {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--rm-text);
  }

  .req {
    color: var(--rm-sage);
  }

  .optional {
    font-weight: var(--font-normal);
    color: var(--rm-dim);
  }

  .input {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-bg);
    color: var(--rm-text);
    width: 100%;
    box-sizing: border-box;
  }

  .input:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 1px;
  }

  .input-invalid {
    border-color: color-mix(in oklab, #f87171 70%, var(--rm-border));
  }

  .textarea {
    resize: vertical;
    min-height: 6rem;
  }

  .checkbox-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .check-label {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    cursor: pointer;
  }

  .check-label input {
    margin-top: 0.2rem;
    flex-shrink: 0;
  }

  .radio-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
  }

  .field-error {
    font-size: var(--text-xs);
    color: #f87171;
  }

  .form-error-banner {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--rm-radius);
    background: color-mix(in oklab, #f87171 12%, var(--rm-surface));
    border: 1px solid color-mix(in oklab, #f87171 35%, var(--rm-border));
    color: var(--rm-text);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-6);
  }

  .form-actions {
    margin-top: var(--space-2);
  }

  .btn-submit {
    width: 100%;
    justify-content: center;
    min-height: var(--button-height-md);
  }

  .form-privacy {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: var(--leading-relaxed);
  }

  .form-success {
    padding: var(--space-8);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    text-align: center;
  }

  .form-success-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: 0 0 var(--space-3);
    color: var(--rm-text);
  }

  .form-success-copy {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }

  .form-success-copy a {
    color: var(--rm-sage);
  }

  .slots-footer {
    padding: var(--space-8) 0 var(--space-4);
    text-align: center;
  }

  .slots-line {
    margin: 0;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-dim);
  }
</style>
