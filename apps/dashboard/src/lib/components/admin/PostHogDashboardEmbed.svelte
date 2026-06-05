<script lang="ts">
  import { onMount } from "svelte";

  export let src: string;
  export let title = "PostHog dashboard";

  const iframeName = "RestormelIngestQualityPostHog";

  let height = 480;

  onMount(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (
        data &&
        typeof data === "object" &&
        data.event === "posthog:dimensions" &&
        data.name === iframeName &&
        typeof data.height === "number" &&
        data.height > 0
      ) {
        height = Math.ceil(data.height);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  });
</script>

<div class="ph-embed-wrap">
  <iframe
    class="ph-embed"
    {title}
    name={iframeName}
    {src}
    width="100%"
    height="{height}px"
    loading="lazy"
    referrerpolicy="no-referrer"
  ></iframe>
</div>

<style>
  .ph-embed-wrap {
    border: var(--border);
    background: var(--color-surface);
    overflow: hidden;
  }
  .ph-embed {
    display: block;
    width: 100%;
    border: 0;
    min-height: 24rem;
  }
</style>
