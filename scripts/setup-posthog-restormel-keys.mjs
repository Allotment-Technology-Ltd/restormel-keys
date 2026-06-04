#!/usr/bin/env node
/**
 * PostHog bootstrap for Restormel Keys:
 * - landing-variant A/B test
 * - restormel-module-* suite flags (MVP defaults)
 *
 * Usage:
 *   POSTHOG_API_KEY=phx_xxx POSTHOG_PROJECT_ID=123553 node scripts/setup-posthog-restormel-keys.mjs --apply
 *   POSTHOG_API_KEY=phx_xxx POSTHOG_PROJECT_ID=123553 node scripts/setup-posthog-restormel-keys.mjs
 */

const APPLY = process.argv.includes("--apply");
/** EU Cloud REST API; override POSTHOG_HOST for US (https://us.posthog.com). */
const HOST = (process.env.POSTHOG_HOST || "https://eu.posthog.com").replace(/\/+$/, "");
const API_KEY = (process.env.POSTHOG_API_KEY || "").trim();
const PROJECT_ID = (process.env.POSTHOG_PROJECT_ID || "").trim();

if (!API_KEY || !PROJECT_ID) {
  console.error("Missing required env vars: POSTHOG_API_KEY and POSTHOG_PROJECT_ID");
  process.exit(1);
}

const TAGS = ["restormel-mvp", "restormel-keys"];

const LANDING_FLAG = {
  key: "landing-variant",
  name: "Restormel Keys landing A/B test",
  active: true,
  filters: {
    groups: [{ properties: [], rollout_percentage: 100 }],
    multivariate: {
      variants: [
        { key: "control", name: "Control", rollout_percentage: 50 },
        { key: "test", name: "Test", rollout_percentage: 50 },
      ],
    },
  },
};

/** MVP module flags — see docs/guides/keys-mvp-module-flags.md */
const MODULE_FLAGS = [
  {
    key: "restormel-module-connect",
    name: "Restormel module: Connect",
    active: true,
    filters: { groups: [{ properties: [], rollout_percentage: 100 }] },
  },
  {
    key: "restormel-module-testing",
    name: "Restormel module: Testing",
    active: true,
    filters: { groups: [{ properties: [], rollout_percentage: 0 }] },
  },
  {
    key: "restormel-module-graph",
    name: "Restormel module: Graph",
    active: true,
    filters: {
      groups: [{ properties: [], rollout_percentage: 100 }],
      multivariate: {
        variants: [{ key: "disabled", name: "Disabled", rollout_percentage: 100 }],
      },
    },
  },
  {
    key: "restormel-module-gateway-providers",
    name: "Restormel module: Gateway providers",
    active: true,
    filters: { groups: [{ properties: [], rollout_percentage: 0 }] },
  },
  {
    key: "restormel-module-guardrails",
    name: "Restormel module: Guardrails",
    active: true,
    filters: { groups: [{ properties: [], rollout_percentage: 0 }] },
  },
  {
    key: "restormel-module-environments",
    name: "Restormel module: Environments",
    active: true,
    filters: { groups: [{ properties: [], rollout_percentage: 0 }] },
  },
  {
    key: "restormel-module-model-pools",
    name: "Restormel module: Model pools",
    active: true,
    filters: { groups: [{ properties: [], rollout_percentage: 0 }] },
  },
  {
    key: "restormel-module-hosted-runtime",
    name: "Restormel module: Hosted runtime",
    active: true,
    filters: { groups: [{ properties: [], rollout_percentage: 0 }] },
  },
  {
    key: "restormel-module-catalog-external-signals",
    name: "Restormel module: Catalog external signals",
    active: true,
    filters: { groups: [{ properties: [], rollout_percentage: 0 }] },
  },
  {
    key: "restormel-module-connect-neon-graph-store",
    name: "Restormel module: Connect host Neon graph store",
    active: true,
    filters: { groups: [{ properties: [], rollout_percentage: 0 }] },
  },
  {
    key: "restormel-module-monitor",
    name: "Restormel module: Monitor (Usage, Logs, Health)",
    active: true,
    filters: { groups: [{ properties: [], rollout_percentage: 0 }] },
  },
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

async function findFlag(key) {
  const res = await request(`/api/projects/${PROJECT_ID}/feature_flags/?search=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(`Failed to list flags (${res.status})`);
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.find((f) => f?.key === key) || null;
}

async function createFlag(payload) {
  const res = await request(`/api/projects/${PROJECT_ID}/feature_flags/`, {
    method: "POST",
    body: JSON.stringify({ ...payload, tags: TAGS }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create flag ${payload.key} (${res.status}): ${text}`);
  }
  return res.json();
}

async function updateFlag(id, payload) {
  const res = await request(`/api/projects/${PROJECT_ID}/feature_flags/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ ...payload, tags: TAGS }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update flag ${payload.key} (${res.status}): ${text}`);
  }
  return res.json();
}

async function upsertFlag(payload) {
  const existing = await findFlag(payload.key);
  if (!APPLY) {
    console.log(`[DRY-RUN] ${payload.key}: ${existing ? `update (id=${existing.id})` : "create"}`);
    return;
  }
  if (existing?.id) {
    await updateFlag(existing.id, payload);
    console.log(`Updated feature flag '${payload.key}' (id=${existing.id})`);
  } else {
    const created = await createFlag(payload);
    console.log(`Created feature flag '${payload.key}' (id=${created?.id ?? "unknown"})`);
  }
}

async function main() {
  console.log(`Host: ${HOST}`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Mode: ${APPLY ? "apply" : "dry-run"}`);

  await upsertFlag(LANDING_FLAG);
  for (const flag of MODULE_FLAGS) {
    await upsertFlag(flag);
  }

  if (!APPLY) {
    console.log("[DRY-RUN] Re-run with --apply to create/update flags.");
  }
}

main().catch((err) => {
  console.error("[setup-posthog-restormel-keys] failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
