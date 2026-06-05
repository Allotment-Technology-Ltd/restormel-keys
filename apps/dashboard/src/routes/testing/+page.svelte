<script lang="ts">
  import LandingPage from "$lib/testing/components/site/LandingPage.svelte";
  import { page } from "$app/stores";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;
</script>

<svelte:head>
  <title>Restormel Testing — Goal-based AI testing for CI</title>
  <meta
    name="description"
    content="Ship AI features without flying blind in CI. Goal-based, workflow-aware tests with clear verdicts — local and GitHub Actions, MIT licensed, Keys-backed execution."
  />
</svelte:head>

<LandingPage moduleFlags={flags} />
