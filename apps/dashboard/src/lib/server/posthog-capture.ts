/**
 * Server-side PostHog capture for Connect telemetry (adblocker-safe mirror).
 */
function posthogHost(): string {
  const raw = process.env.POSTHOG_HOST ?? process.env.PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  return raw
    .replace(/\/$/, "")
    .replace("eu.posthog.com", "eu.i.posthog.com")
    .replace("us.posthog.com", "us.i.posthog.com");
}

export async function captureServerPostHogEvent(
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const apiKey = process.env.POSTHOG_API_KEY ?? process.env.PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;
  try {
    await fetch(`${posthogHost()}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $lib: "restormel-dashboard-server" },
      }),
    });
  } catch {
    // Fire-and-forget — never block review/ingest paths.
  }
}

export function workspacePostHogDistinctId(workspaceId: string): string {
  return `ws_${workspaceId.slice(0, 8)}`;
}
