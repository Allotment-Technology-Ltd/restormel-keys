<script lang="ts">
  /** Keep curl JSON out of markup so `{` does not start a Svelte expression. */
  const curlSmokeExample = String.raw`curl -sS "\${BASE}/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $YOUR_SERVER_KEY" \
  -d '{"model":"your-model-id","messages":[{"role":"user","content":"ping"}],"max_tokens":8}'`;
</script>

<svelte:head>
  <title>BYO-GPU — single VM path — Restormel Keys</title>
  <meta
    name="description"
    content="Opinionated path: one VM, OpenAI-compatible inference, bind to Restormel Keys. You pay the cloud or metal provider; Restormel does not host GPU."
  />
</svelte:head>

<div class="doc-content">
  <h1>BYO-GPU — single VM happy path</h1>
  <p class="doc-intro">
    This guide gets you from <strong>zero</strong> to <strong>Keys calling your GPU</strong> with minimal moving parts.
    You run inference on <strong>your</strong> VM (cloud or bare metal). Restormel provides the <strong>control layer</strong> (routes, policies, aliases)—not the GPU bill.
  </p>

  <div class="callout callout-tip">
    <strong>Prereqs</strong> — A machine with an NVIDIA driver + CUDA stack appropriate for your server image; outbound HTTPS from your app to the VM (or VPC peering / private link per your design).
  </div>

  <h2>1. Run an OpenAI-compatible server</h2>
  <p>
    Pick one stack (examples only—pin versions in production). Expose <code>/v1/chat/completions</code> (or your vendor’s documented OpenAI-compatible path).
    NVIDIA NGC and similar catalogs ship GPU-optimized images; bind ports only on private interfaces unless you intend public access.
  </p>
  <pre class="doc-pre"><code># Example shape only — replace with your image and model paths.
docker run --gpus all -p 127.0.0.1:8000:8000 \
  -e ... \
  your-registry/your-openai-compatible-server:tag</code></pre>

  <h2>2. Smoke-test from your laptop or bastion</h2>
  <pre class="doc-pre"><code>{curlSmokeExample}</code></pre>
  <p class="muted">Do not paste live keys into tickets or CI logs.</p>

  <h2>3. Register the endpoint in Keys</h2>
  <ol>
    <li>In the dashboard, add a <strong>custom / private</strong> provider or gateway configuration pointing at <code>https://your-vm-or-lb/v1</code> (or HTTP inside VPC).</li>
    <li>Create a <strong>logical model alias</strong> in the project model index so your app uses a stable ID (e.g. <code>private/llama-l4</code>).</li>
    <li>Add a <strong>policy</strong> that allows that alias only where appropriate.</li>
  </ol>

  <h2>4. Validate with Restormel Testing</h2>
  <p>
    Add a short smoke goal that hits the resolved route (latency, HTTP 200, JSON shape). Use <strong>your</strong> GitHub Actions minutes or self-hosted runners so runner COGS stay on your side.
    See <a href="/keys/docs/guides/testing-gpu-route-smoke">GPU route smoke (Testing)</a>.
  </p>

  <h2>5. Operations</h2>
  <ul>
    <li><strong>Rotation</strong> — Rotate server API keys in your secret store; update Keys integration references.</li>
    <li><strong>Upgrades</strong> — When you bump container tags (e.g. new NGC build), re-run smoke ACs and capture a <strong>Release pack</strong> for audit (CLI: <code>testing release-pack</code>).</li>
  </ul>

  <p class="doc-footer">
    <a href="/keys/docs/guides/byo-gpu-kubernetes">Next: minimal Kubernetes path →</a>
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
  .doc-content ol {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
  }
  .muted {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .doc-pre {
    background: var(--rm-surface-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    overflow-x: auto;
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
  .doc-footer {
    margin-top: var(--space-8);
  }
  .callout {
    border-radius: var(--radius-md);
    padding: var(--space-4);
    margin: 0 0 var(--space-6);
  }
  .callout-tip {
    background: color-mix(in srgb, var(--rm-teal) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--rm-teal) 35%, transparent);
  }
</style>
