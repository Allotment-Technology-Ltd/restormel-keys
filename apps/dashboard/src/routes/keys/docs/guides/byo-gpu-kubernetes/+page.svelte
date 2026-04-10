<svelte:head>
  <title>BYO-GPU — minimal Kubernetes path — Restormel Keys</title>
  <meta
    name="description"
    content="Opinionated minimal Kubernetes deployment for OpenAI-compatible GPU inference and Restormel Keys binding."
  />
</svelte:head>

<div class="doc-content">
  <h1>BYO-GPU — minimal Kubernetes path</h1>
  <p class="doc-intro">
    One <strong>Deployment</strong>, one <strong>Service</strong>, one stable in-cluster DNS name. Keys stays outside the cluster or in your app tier—either way, you expose an <strong>OpenAI-compatible</strong> HTTP surface.
  </p>

  <div class="callout callout-tip">
    <strong>Not a production SRE guide</strong> — This is the smallest shape that works. Add HPA, PDBs, network policies, and monitoring for real clusters.
  </div>

  <h2>1. Deployment sketch</h2>
  <ul>
    <li>Request <code>nvidia.com/gpu: 1</code> (or your accelerator resource) on nodes that advertise it.</li>
    <li>Mount model weights via PVC or download init container—follow your model license.</li>
    <li>Listen on container port <code>8000</code> (example); liveness/readiness HTTP probes if your server supports them.</li>
  </ul>

  <h2>2. Service</h2>
  <p>
    Use <code>ClusterIP</code> and reach the API from your gateway or mesh. If Keys resolves from outside the cluster, front with an Ingress or internal load balancer.
  </p>
  <pre class="doc-pre"><code># Illustrative only — replace images, probes, and resources.
apiVersion: v1
kind: Service
metadata:
  name: llm-openai
spec:
  selector:
    app: llm-openai
  ports:
    - port: 8000
      targetPort: 8000</code></pre>

  <h2>3. Keys binding</h2>
  <p>
    Point your Keys private provider base URL at <code>http://llm-openai.default.svc.cluster.local:8000/v1</code> (or HTTPS equivalent). Use the same logical model alias and policy steps as the
    <a href="/keys/docs/guides/byo-gpu-vm">VM guide</a>.
  </p>

  <h2>4. Smoke in CI</h2>
  <p>
    Prefer a <strong>self-hosted</strong> runner with cluster access or a scheduled job inside the cluster—keep GPU CI costs explicit. Template:
    <a href="/keys/docs/guides/testing-gpu-route-smoke">GPU route smoke (Testing)</a>.
  </p>

  <p class="doc-footer">
    <a href="/keys/docs/guides/byo-gpu-vm">← VM happy path</a>
    ·
    <a href="/keys/docs/guides/private-openai-compatible-endpoints">Private endpoint matrix (repo doc)</a>
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
