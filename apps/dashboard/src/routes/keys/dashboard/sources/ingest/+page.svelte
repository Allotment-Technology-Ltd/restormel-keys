<script lang="ts">
  import ConnectPipelineWizard from "$lib/components/connect/pipeline/ConnectPipelineWizard.svelte";
  import type { PageData } from "./$types";

  export let data: PageData;
</script>

<ConnectPipelineWizard {data} />
