<svelte:head>
  <title>Privacy Policy — Restormel Keys</title>
  <meta
    name="description"
    content="Privacy policy for Restormel Keys (Allotment Technology Ltd). What we process, why, and how to contact us."
  />
</svelte:head>

<div class="legal">
  <h1>Privacy Policy</h1>
  <p class="meta"><strong>Allotment Technology Ltd</strong> · Version 2026-03-18 · Effective 18 March 2026</p>

  <h2>1. Who we are</h2>
  <p>
    Restormel Keys is operated by <strong>Allotment Technology Ltd</strong> (England and Wales). We act as the controller
    for personal data described in this policy.
  </p>
  <p>Contact: <a href="mailto:contact@restormel.dev">contact@restormel.dev</a></p>

  <h2>2. What we process</h2>

  <h3>Account and authentication</h3>
  <p>
    When you sign in to the Dashboard, we receive identifiers (such as your GitHub-linked account email and an internal
    user ID) via our authentication provider. We use these to create your workspace and let you manage projects.
  </p>

  <h3>Billing and payments (Paddle as merchant of record)</h3>
  <p>
    If you subscribe to Pro, Paddle processes payments as Merchant of Record. We do not store full card details. We store
    billing metadata needed to reflect your plan status (for example: plan, subscription status, and provider
    customer/subscription identifiers).
  </p>

  <h3>Product usage and operational data</h3>
  <p>
    We process request metadata and operational logs (for example timestamps, request status, and performance metrics) to
    operate the service, improve reliability, and investigate abuse and incidents.
  </p>

  <h3>Keys and credentials (BYOK-first)</h3>
  <p>
    Restormel Keys is BYOK-first. You can keep provider material entirely in your gateway or secret store, or optionally use
    <strong>Connections</strong> to store provider API keys <strong>encrypted at rest</strong> when your deployment operator configures
    encryption.
  </p>
  <ul>
    <li><strong>Gateway Keys</strong> (used to call Restormel APIs) are stored as a prefix + hash; we do not store raw values.</li>
    <li>
      <strong>Provider credentials</strong> (OpenAI/Anthropic/etc.): if you add a <strong>hosted API key</strong> in the Dashboard, we store
      ciphertext (not plaintext) where encryption is enabled; the UI shows masked labels only and does not display the full secret after
      save. You may instead enter a <strong>credential reference</strong> (non-secret label) if you keep the real secret elsewhere. Rotate
      or revoke from Connections when your security policy requires it.
    </li>
  </ul>

  <h3>Analytics</h3>
  <p>
    We may use product analytics (for example PostHog) to understand feature usage and improve the product. We do not
    intentionally send secrets to analytics tools.
  </p>

  <h2>3. Why we process data (legal bases)</h2>
  <ul>
    <li><strong>Contract</strong>: to provide the Dashboard, APIs, and subscription features you request.</li>
    <li><strong>Legitimate interests</strong>: service security, abuse prevention, diagnostics, and product improvement.</li>
    <li><strong>Legal obligation</strong>: finance/tax records and lawful requests where required.</li>
  </ul>

  <h2>4. Sharing and sub-processors</h2>
  <p>We do not sell personal data. We share data with vendors only to provide Restormel Keys, such as:</p>
  <ul>
    <li><strong>Authentication provider</strong>: to support sign-in and sessions.</li>
    <li><strong>Neon</strong>: hosted Postgres database.</li>
    <li><strong>Vercel</strong>: hosting for the Dashboard and site surfaces.</li>
    <li><strong>Paddle</strong>: checkout, subscriptions, and billing administration (Merchant of Record).</li>
    <li><strong>Zuplo</strong>: control-plane API gateway (where enabled).</li>
    <li><strong>PostHog</strong>: product analytics (where enabled).</li>
  </ul>

  <h2>5. International transfers</h2>
  <p>
    Some processors may handle data outside the UK/EEA (including in the US). Where required, we rely on appropriate
    safeguards made available by our providers.
  </p>

  <h2>6. Retention</h2>
  <ul>
    <li><strong>Account/workspace records</strong>: retained while your account is active.</li>
    <li><strong>Billing records</strong>: retained as required for accounting and compliance.</li>
    <li><strong>Operational logs</strong>: retained for a limited period for security and reliability.</li>
  </ul>

  <h2>7. Your rights</h2>
  <p>
    Depending on your location and applicable law, you may request access, correction, deletion, portability, restriction,
    or objection. Send requests to <a href="mailto:contact@restormel.dev">contact@restormel.dev</a>. We may verify identity
    before acting.
  </p>

  <h2>8. Children</h2>
  <p>Restormel Keys is intended for users 18+ and is not directed to children.</p>

  <h2>9. Security</h2>
  <p>
    We use technical and organizational controls, including encryption in transit, access controls, and production access
    restrictions. Never share raw keys in support messages.
  </p>

  <h2>10. Changes</h2>
  <p>We may update this policy. Material updates will be reflected by a new version and effective date.</p>
</div>

<style>
  .legal {
    max-width: var(--rm-container-narrow);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-2);
    color: var(--rm-text);
  }
  .meta {
    margin: 0 0 var(--space-6);
    color: var(--rm-dim);
    font-size: var(--text-sm);
  }
  h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: var(--space-8) 0 var(--space-3);
    color: var(--rm-text);
  }
  h3 {
    font-size: var(--text-base);
    margin: var(--space-5) 0 var(--space-2);
    color: var(--rm-text);
  }
  p,
  li {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-3);
  }
  ul {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
  }
  a {
    color: var(--rm-sage);
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
</style>

