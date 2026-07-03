<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  onMount(() => {
    void goto("/dev/graph-portability", { replaceState: true });
  });
</script>

<p>Redirecting to graph portability demo…</p>
