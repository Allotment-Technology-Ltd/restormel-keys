<script lang="ts">
  /** Static hero preview cards — matches restormel_redesign.html samples. */
</script>

<div class="hero-preview">
  <p class="preview-label">Restormel Keys — Route</p>
  <div class="preview-card" data-card>
    <div class="preview-card-head">
      <div class="preview-card-head-title">
        RESOLVE CHAIN <span>KEYS</span>
      </div>
      <span class="preview-card-meta">production-default</span>
    </div>
    <div class="preview-card-body">
      <div><span class="code-key">route:</span> <span class="code-val">production-default</span></div>
      <div><span class="code-key">primary</span> <span class="code-muted">→</span> <span class="code-accent">openai</span> / <span class="code-val">gpt-4o-mini</span></div>
      <div><span class="code-key">fallback</span> <span class="code-muted">→</span> <span class="code-accent">anthropic</span> / <span class="code-val">claude-3-5</span></div>
      <div><span class="code-key">policy:</span> <span class="code-val">cost-cap-pass</span></div>
      <div class="code-comment"># BYOK · no proxy · your keys</div>
    </div>
  </div>

  <p class="preview-label preview-label-spaced">Restormel Connect — Agent context</p>
  <div class="preview-card" data-card>
    <div class="preview-card-head">
      <div class="preview-card-head-title">
        AGENT CONTEXT LAYER <span>CONNECT</span>
      </div>
      <span class="preview-card-meta">94% verified</span>
    </div>
    <div class="preview-card-body">
      <div><span class="code-key">graph:</span> <span class="code-val">847 ideas · 2.1k edges</span></div>
      <div><span class="code-key">retrieve:</span> <span class="code-val">depth: standard</span></div>
      <div><span class="code-key">agent:</span> <span class="code-val">tool call + context pack</span></div>
      <div><span class="code-key">verify:</span> <span class="code-val">→ 94% claims supported</span></div>
      <div class="code-comment"># ingest · retrieve · verify</div>
    </div>
  </div>
</div>

<style>
  .hero-preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .preview-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-ink-faint);
    margin: 0 0 0.25rem;
  }

  .preview-label-spaced {
    margin-top: 0.5rem;
  }

  .preview-card {
    background: var(--color-surface);
    border: var(--border);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .preview-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: 0.6rem 0.875rem;
    border-bottom: var(--border);
    background: var(--color-ink);
    color: var(--color-surface);
  }

  .preview-card-head-title {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .preview-card-head-title span {
    background: var(--color-yellow);
    color: var(--color-ink);
    padding: 1px 6px;
    font-size: 9px;
  }

  .preview-card-meta {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: #aaaaaa;
    white-space: nowrap;
  }

  .preview-card-body {
    padding: 0.875rem;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.7;
    color: #2a2520;
  }

  .code-comment {
    color: #8a8070;
    margin-top: 6px;
  }

  .code-key {
    color: var(--color-blue);
    font-weight: 700;
  }

  .code-val {
    color: #1a6b3c;
  }

  .code-accent {
    color: #7b3fb0;
  }

  .code-muted {
    color: #8a8070;
  }
</style>
