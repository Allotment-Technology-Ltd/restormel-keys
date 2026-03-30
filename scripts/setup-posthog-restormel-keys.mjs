#!/usr/bin/env node
/**
 * PostHog bootstrap for Restormel Keys landing A/B test.
 *
 * Creates or updates the `landing-variant` feature flag with:
 * - control: 50%
 * - test: 50%
 *
 * Usage:
 *   POSTHOG_API_KEY=phx_xxx POSTHOG_PROJECT_ID=123 node scripts/setup-posthog-restormel-keys.mjs --apply
 *   POSTHOG_API_KEY=phx_xxx POSTHOG_PROJECT_ID=123 node scripts/setup-posthog-restormel-keys.mjs
 */

const APPLY = process.argv.includes("--apply");
const HOST = (process.env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/+$/, "");
const API_KEY = (process.env.POSTHOG_API_KEY || "").trim();
const PROJECT_ID = (process.env.POSTHOG_PROJECT_ID || "").trim();

if (!API_KEY || !PROJECT_ID) {
  console.error("Missing required env vars: POSTHOG_API_KEY and POSTHOG_PROJECT_ID");
  process.exit(1);
}

const FLAG_KEY = "landing-variant";
const VARIANTS = [
  { key: "control", name: "Control", rollout_percentage: 50 },
  { key: "test", name: "Test", rollout_percentage: 50 },
];

function request(path, options = {}) {
  return fetch(`${HOST}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

function flagPayload() {
  return {
    key: FLAG_KEY,
    name: "Restormel Keys landing A/B test",
    active: true,
    filters: {
      groups: [{ properties: [], rollout_percentage: 100 }],
      multivariate: {
        variants: VARIANTS,
      },
    },
  };
}

async function findFlag() {
  const res = await request(`/api/projects/${PROJECT_ID}/feature_flags/?search=${encodeURIComponent(FLAG_KEY)}`);
  if (!res.ok) throw new Error(`Failed to list flags (${res.status})`);
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.find((f) => f?.key === FLAG_KEY) || null;
}

async function createFlag(payload) {
  const res = await request(`/api/projects/${PROJECT_ID}/feature_flags/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create flag (${res.status})`);
  return res.json();
}

async function updateFlag(id, payload) {
  const res = await request(`/api/projects/${PROJECT_ID}/feature_flags/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update flag (${res.status})`);
  return res.json();
}

async function main() {
  const payload = flagPayload();
  const existing = await findFlag();

  if (!APPLY) {
    console.log(`[DRY-RUN] Host: ${HOST}`);
    console.log(`[DRY-RUN] Project: ${PROJECT_ID}`);
    console.log(`[DRY-RUN] Flag key: ${FLAG_KEY}`);
    console.log(`[DRY-RUN] Existing flag: ${existing ? `yes (id=${existing.id})` : "no"}`);
    console.log("[DRY-RUN] Target split: control=50%, test=50%");
    console.log("[DRY-RUN] Conversion event in app code: signup_clicked");
    return;
  }

  if (existing?.id) {
    await updateFlag(existing.id, payload);
    console.log(`Updated feature flag '${FLAG_KEY}' (id=${existing.id})`);
  } else {
    const created = await createFlag(payload);
    console.log(`Created feature flag '${FLAG_KEY}' (id=${created?.id ?? "unknown"})`);
  }
}

main().catch((err) => {
  console.error("[setup-posthog-restormel-keys] failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});

