<svelte:head>
  <title>Integration failure attribution — Restormel Keys</title>
  <meta
    name="description"
    content="How to tell Restormel backend issues from provider, policy, or host wiring when embedding KeyManager and ModelSelector."
  />
</svelte:head>

<div class="doc-content">
  <h1>Integration failure attribution</h1>
  <p class="doc-intro">
    Host apps should not guess whether a red <code>ModelSelector</code> state is “Restormel down”, “policy blocked”, or “provider key invalid”.
    Use the packaged <strong>status callbacks</strong>, <strong>batch policy availability</strong>, and the shared backend message constant from <code>@restormel/keys-elements</code>.
  </p>

  <h2>Typed props and status</h2>
  <p>
    Import <code>KeyManagerProps</code>, <code>ModelSelectorProps</code>, <code>ModelSelectorHostStatus</code>, and
    <code>RESTORMEL_BACKEND_ERROR_MESSAGE</code> from <code>@restormel/keys-elements</code> (see package exports).
    Wire <code>onStatusChange</code> to show banners: <code>loading</code>, <code>ready</code>, <code>empty</code>, <code>error</code>, <code>degraded</code>.
  </p>

  <h2>Policy vs provider</h2>
  <ul>
    <li>
      Pass a server-built <code>policyAvailability</code> map so blocked models skip unnecessary resolve calls (batch evaluation on the host).
    </li>
    <li>
      When status is <code>degraded</code>, nothing is selectable under current policy + credentials—distinguish from <code>error</code> (load/transport failure).
    </li>
  </ul>

  <h2>Canonical assessment</h2>
  <p>
    Dogfood priorities and ordering:
    <a
      href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/reference/restormel-first-assessment.md"
      >docs/reference/restormel-first-assessment.md</a
    >.
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
  .doc-content p,
  .doc-content li {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-3);
  }
  .doc-content ul {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
  }
</style>
