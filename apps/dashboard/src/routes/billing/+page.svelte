<script lang="ts">
  import { base } from "$app/paths";
</script>

<h1 class="page-title">Billing</h1>
<p class="page-desc">Current tier and subscription. (Billing integration in 3.5.)</p>
<p class="placeholder">Manage subscription and view invoices here after Paddle billing is wired.</p>
<p><a href="https://restormel.dev/keys/pricing">View pricing</a></p>

<style>
  .page-title {
    font-family: var(--rm-font-display);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 0.5rem;
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: 0.875rem;
    margin: 0 0 1rem;
  }
  .placeholder {
    color: var(--rm-dim);
    font-size: 0.875rem;
  }
</style>
