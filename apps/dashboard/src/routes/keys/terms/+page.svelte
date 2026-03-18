<svelte:head>
  <title>Terms of Service — Restormel Keys</title>
  <meta
    name="description"
    content="Terms of service for Restormel Keys (Allotment Technology Ltd). Subscription terms, acceptable use, and refund policy."
  />
</svelte:head>

<div class="legal">
  <h1>Terms of Service</h1>
  <p class="meta"><strong>Allotment Technology Ltd</strong> · Version 2026-03-18 · Effective 18 March 2026</p>

  <h2>1. Agreement and eligibility</h2>
  <p>By using Restormel Keys, you agree to these Terms. If you do not agree, do not use the service. You must be 18+.</p>
  <p>Operator: <strong>Allotment Technology Ltd</strong>. Contact: <a href="mailto:contact@restormel.dev">contact@restormel.dev</a>.</p>

  <h2>2. Service overview</h2>
  <p>
    Restormel Keys is a developer product for BYOK (bring your own key), routing decisions, policy controls, and related
    dashboard/API tooling. It is library-first and is designed to sit above your existing provider access layer (gateway or
    direct providers). Restormel Keys is not an execution proxy by default.
  </p>

  <h2>3. Plans, limits, and entitlements</h2>
  <p>Restormel Keys offers Free and Pro plans. Features and limits may change over time with reasonable notice.</p>

  <h2>4. Billing, auto-renewal, and cancellation</h2>
  <p>
    Payments are processed by Paddle as Merchant of Record. Subscriptions may auto-renew unless canceled before renewal
    through the billing portal.
  </p>

  <h2>5. Refund policy</h2>
  <p>
    Payments are non-refundable except where refund rights are required by applicable law. See
    <a href="/keys/refund-policy">Refund Policy</a>.
  </p>

  <h2>6. Acceptable use</h2>
  <p>You must not:</p>
  <ul>
    <li>Use the service for illegal, abusive, or harmful purposes.</li>
    <li>Circumvent limits, billing controls, authentication, or security mechanisms.</li>
    <li>Attempt to exfiltrate secrets or submit credentials you are not authorized to use.</li>
    <li>Automate abusive traffic or load that harms the service.</li>
  </ul>

  <h2>7. Intellectual property</h2>
  <p>
    Restormel Keys software and service design are protected by applicable IP law. These Terms do not transfer ownership
    of Restormel IP to you. Open-source components remain under their respective licenses.
  </p>

  <h2>8. Disclaimers</h2>
  <p>The service is provided “as is” and “as available” without warranties of uninterrupted operation or fitness for a particular purpose.</p>

  <h2>9. Limitation of liability</h2>
  <p>
    To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive
    damages. Aggregate liability for any claim is limited to amounts paid by you in the previous 12 months (or GBP 50 if
    you have paid nothing), except where such limits are not permitted by law.
  </p>

  <h2>10. Suspension and termination</h2>
  <p>
    You may stop using Restormel Keys at any time. We may suspend or terminate access for violations, abuse, fraud, legal
    risk, or operational reasons.
  </p>

  <h2>11. Changes</h2>
  <p>We may update these Terms. Material changes are reflected by a new version, effective date, and changelog entry where applicable.</p>

  <h2>12. Governing law</h2>
  <p>These Terms are governed by the laws of England and Wales, without prejudice to mandatory consumer protections where applicable.</p>
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

