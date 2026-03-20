<svelte:head>
  <title>How it fits together — Restormel Keys</title>
</svelte:head>

<h1>How it all fits together</h1>
<p class="intro">
  Restormel has two API surfaces and two key types. Use this page when you need to decide which URL/key belongs to which task.
</p>

<table class="table">
  <thead>
    <tr><th>Surface</th><th>Base URL</th><th>Auth</th><th>Used for</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Dashboard API (runtime)</td>
      <td><code>https://restormel.dev/keys/dashboard/api</code></td>
      <td><code>rk_...</code></td>
      <td>Resolve, policy evaluate, routes/steps, simulate, lifecycle.</td>
    </tr>
    <tr>
      <td>Gateway API (control-plane)</td>
      <td><code>https://restormel-keys-gateway-main-bc13eba.zuplo.site/api</code></td>
      <td><code>zpka_...</code></td>
      <td>Project/key CRUD and gateway-level management.</td>
    </tr>
  </tbody>
</table>

<h2>Where to start</h2>
<ul>
  <li>If you are wiring app runtime decisions, start at <a href="/keys/docs/cloud-api">Cloud API</a> and use <code>rk_...</code>.</li>
  <li>If you need control-plane API operations in the portal, use <code>zpka_...</code>.</li>
  <li>Dashboard UI setup is always at <a href="/keys/dashboard">Dashboard</a>.</li>
</ul>

<style>
  .intro { color: var(--rm-muted); margin: 0 0 var(--space-4); }
  .table { width: 100%; border-collapse: collapse; margin: 0 0 var(--space-4); font-size: var(--text-sm); }
  .table th, .table td { border: 1px solid var(--rm-border); padding: var(--space-2) var(--space-3); text-align: left; }
  .table th { background: var(--rm-surface-raised); color: var(--rm-text); }
  .table td { color: var(--rm-muted); }
</style>
