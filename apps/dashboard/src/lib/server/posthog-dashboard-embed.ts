const DEFAULT_POSTHOG_APP_HOST = "https://eu.posthog.com";
const DEFAULT_PROJECT_ID = "123553";
const INGEST_QUALITY_DASHBOARD_ID = 726666;

export const INGEST_QUALITY_POSTHOG_DASHBOARD_URL = `${DEFAULT_POSTHOG_APP_HOST}/project/${DEFAULT_PROJECT_ID}/dashboard/${INGEST_QUALITY_DASHBOARD_ID}`;

type SharingConfig = {
  enabled?: boolean;
  access_token?: string;
};

function posthogAppHost(): string {
  const raw = process.env.POSTHOG_HOST ?? process.env.PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_APP_HOST;
  return raw.replace(/\/+$/, "").replace(/\.i\.posthog\.com$/, ".posthog.com");
}

function posthogProjectId(): string {
  return (process.env.POSTHOG_PROJECT_ID ?? DEFAULT_PROJECT_ID).trim();
}

function posthogApiKey(): string | null {
  const key = (
    process.env.POSTHOG_PERSONAL_API_KEY ??
    process.env.POSTHOG_API_KEY ??
    ""
  ).trim();
  return key || null;
}

/** Accept only PostHog public embed URLs (no auth cookies required). */
export function normalizePostHogEmbedUrl(raw: string | undefined | null): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (!/\.posthog\.com$/i.test(url.hostname)) return null;
    if (!url.pathname.startsWith("/embedded/")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function buildEmbedUrl(accessToken: string): string {
  return `${posthogAppHost()}/embedded/${accessToken}`;
}

async function fetchSharingConfig(apiKey: string): Promise<SharingConfig | null> {
  const host = posthogAppHost();
  const projectId = posthogProjectId();
  const url = `${host}/api/projects/${projectId}/dashboards/${INGEST_QUALITY_DASHBOARD_ID}/sharing/`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as SharingConfig;
}

async function enableSharing(apiKey: string): Promise<SharingConfig | null> {
  const host = posthogAppHost();
  const projectId = posthogProjectId();
  const url = `${host}/api/projects/${projectId}/dashboards/${INGEST_QUALITY_DASHBOARD_ID}/sharing/refresh/`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled: true, password_required: false }),
  });
  if (!res.ok) return null;
  return (await res.json()) as SharingConfig;
}

/**
 * Resolve iframe src for the Connect Ingest Quality PostHog dashboard.
 * Prefers POSTHOG_INGEST_QUALITY_DASHBOARD_EMBED_URL; otherwise uses PostHog sharing API
 * when POSTHOG_API_KEY / POSTHOG_PERSONAL_API_KEY is configured.
 */
export async function resolveIngestQualityPostHogEmbedUrl(): Promise<string | null> {
  const explicit = normalizePostHogEmbedUrl(
    process.env.POSTHOG_INGEST_QUALITY_DASHBOARD_EMBED_URL,
  );
  if (explicit) return explicit;

  const apiKey = posthogApiKey();
  if (!apiKey) return null;

  let sharing = await fetchSharingConfig(apiKey);
  if (!sharing?.enabled || !sharing.access_token) {
    sharing = await enableSharing(apiKey);
  }
  if (!sharing?.enabled || !sharing.access_token) return null;
  return buildEmbedUrl(sharing.access_token);
}
