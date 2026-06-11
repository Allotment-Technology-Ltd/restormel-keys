/**
 * GET /api/search?q=<query>
 *
 * Global search for the command palette.
 * Auth: session only — workspace-scoped; never cross-workspace.
 * Returns typed result groups covering: projects, routes, policies, gateway keys (by prefix),
 * models, ingest runs (by label), and graph units (by text).
 *
 * Security: every query is bound to `workspaceId` from the resolved session.
 *           A workspace must never see another workspace's entities.
 *           See acceptance criterion: negative workspace-scoping test.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { getSql, listProjectsByWorkspace, listPolicies } from "$lib/server/neon";
import { listConnectIngestJobsForWorkspace } from "$lib/server/connect-ingest-jobs";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import type { SearchResultItem } from "$lib/command-palette";

/** Per-type result caps to keep the palette fast. */
const CAPS: Record<string, number> = {
  project: 8,
  route: 8,
  policy: 6,
  gateway_key: 6,
  model: 6,
  ingest_run: 6,
  graph_unit: 5,
};

const MIN_QUERY_LEN = 1;

export const GET: RequestHandler = async ({ url, locals }) => {
  const t0 = Date.now();

  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });

  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length < MIN_QUERY_LEN) {
    return json({ groups: [], elapsed_ms: Date.now() - t0 });
  }

  const { workspaceId } = ctx;
  const pattern = `%${query.toLowerCase()}%`;
  const sql = getSql();

  const results: SearchResultItem[] = [];

  // --- Projects ---
  try {
    const projects = await listProjectsByWorkspace(workspaceId);
    const matched = projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    for (const p of matched.slice(0, CAPS.project)) {
      results.push({
        kind: "project",
        id: p.id,
        title: p.name,
        subtitle: p.isRestormelTesting ? "Testing project" : null,
        url: `${DASHBOARD_BASE}/projects/${p.id}`,
      });
    }
  } catch (e) {
    console.warn("[search] projects query failed:", e instanceof Error ? e.message : e);
  }

  // --- Routes (join projects → workspace scope) ---
  try {
    const routeRows = await sql`
      SELECT r.id, r.name, r.status, r.project_id AS "projectId", p.name AS "projectName"
      FROM routes r
      INNER JOIN projects p ON p.id = r.project_id
      WHERE p.workspace_id = ${workspaceId}
        AND LOWER(r.name) LIKE ${pattern}
      ORDER BY r.created_at DESC
      LIMIT ${CAPS.route}
    `;
    for (const row of routeRows as { id: string; name: string; status: string; projectId: string; projectName: string }[]) {
      results.push({
        kind: "route",
        id: row.id,
        title: row.name,
        subtitle: row.projectName ?? null,
        url: `${DASHBOARD_BASE}/projects/${row.projectId}/routes/${row.id}`,
      });
    }
  } catch (e) {
    console.warn("[search] routes query failed:", e instanceof Error ? e.message : e);
  }

  // --- Policies ---
  try {
    const policies = await listPolicies(workspaceId);
    const matched = policies.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    for (const p of matched.slice(0, CAPS.policy)) {
      results.push({
        kind: "policy",
        id: p.id,
        title: p.name,
        subtitle: p.type ?? null,
        url: `${DASHBOARD_BASE}/policies/${p.id}`,
      });
    }
  } catch (e) {
    console.warn("[search] policies query failed:", e instanceof Error ? e.message : e);
  }

  // --- Gateway keys (by prefix, workspace-scoped via projects) ---
  try {
    const keyRows = await sql`
      SELECT k.id, k.key_prefix AS "keyPrefix", k.created_at AS "createdAt",
             p.name AS "projectName", p.id AS "projectId"
      FROM api_keys k
      INNER JOIN projects p ON p.id = k.project_id
      WHERE p.workspace_id = ${workspaceId}
        AND LOWER(k.key_prefix) LIKE ${pattern}
      ORDER BY k.created_at DESC
      LIMIT ${CAPS.gateway_key}
    `;
    for (const row of keyRows as { id: string; keyPrefix: string; projectName: string; projectId: string }[]) {
      results.push({
        kind: "gateway_key",
        id: row.id,
        title: row.keyPrefix,
        subtitle: row.projectName ?? null,
        url: `${DASHBOARD_BASE}/access`,
      });
    }
  } catch (e) {
    console.warn("[search] gateway_keys query failed:", e instanceof Error ? e.message : e);
  }

  // --- Models (catalog-wide, no workspace scope needed — models are global) ---
  try {
    const modelRows = await sql`
      SELECT id, name, provider
      FROM models
      WHERE LOWER(name) LIKE ${pattern}
        OR LOWER(provider) LIKE ${pattern}
      ORDER BY name ASC
      LIMIT ${CAPS.model}
    `;
    for (const row of modelRows as { id: string; name: string; provider: string }[]) {
      results.push({
        kind: "model",
        id: row.id,
        title: row.name,
        subtitle: row.provider ?? null,
        url: `${DASHBOARD_BASE}/models/${row.id}`,
      });
    }
  } catch (e) {
    console.warn("[search] models query failed:", e instanceof Error ? e.message : e);
  }

  // --- Ingest runs (by label — workspace-scoped) ---
  try {
    const runs = await listConnectIngestJobsForWorkspace({ workspaceId, limit: 50 });
    const matched = runs.filter((r) => {
      const label = (r.label ?? r.id).toLowerCase();
      return label.includes(query.toLowerCase());
    });
    for (const run of matched.slice(0, CAPS.ingest_run)) {
      results.push({
        kind: "ingest_run",
        id: run.id,
        title: run.label ?? `Run ${run.id.slice(0, 8)}`,
        subtitle: run.status ?? null,
        url: `${DASHBOARD_BASE}/connect/ingest/${run.id}`,
      });
    }
  } catch (e) {
    console.warn("[search] ingest_runs query failed:", e instanceof Error ? e.message : e);
  }

  // --- Graph units (text search — workspace-scoped via knowledge_graph_units) ---
  // We reuse the existing knowledge_graph_units Postgres table when present.
  // Note: current latency is a full-table ILIKE scan on up to CAPS.graph_unit rows.
  //       This is honest per the acceptance criterion — no new index added.
  try {
    const unitRows = await sql`
      SELECT id, text, validation_status AS "validationStatus"
      FROM knowledge_graph_units
      WHERE workspace_id = ${workspaceId}
        AND LOWER(text) LIKE ${pattern}
      ORDER BY created_at DESC
      LIMIT ${CAPS.graph_unit}
    `;
    for (const row of unitRows as { id: string; text: string; validationStatus: string | null }[]) {
      const truncated = row.text.length > 80 ? row.text.slice(0, 77) + "…" : row.text;
      results.push({
        kind: "graph_unit",
        id: row.id,
        title: truncated,
        subtitle: row.validationStatus ?? null,
        url: `${DASHBOARD_BASE}/connect/graph?unit=${encodeURIComponent(row.id)}`,
      });
    }
  } catch (e) {
    // Table may not exist in every deployment configuration — degrade silently.
    console.warn("[search] graph_units query failed:", e instanceof Error ? e.message : e);
  }

  // Group by kind (preserving order within each kind).
  const kindOrder: SearchResultItem["kind"][] = [
    "project", "route", "policy", "gateway_key", "model", "ingest_run", "graph_unit",
  ];
  const kindLabels: Record<SearchResultItem["kind"], string> = {
    project: "Projects",
    route: "Routes",
    policy: "Guard rails",
    gateway_key: "Gateway keys",
    model: "Models",
    ingest_run: "Ingest runs",
    graph_unit: "Graph units",
  };

  const groupMap = new Map<SearchResultItem["kind"], SearchResultItem[]>();
  for (const item of results) {
    const list = groupMap.get(item.kind) ?? [];
    list.push(item);
    groupMap.set(item.kind, list);
  }

  const groups = kindOrder
    .map((kind) => ({ kind, label: kindLabels[kind], items: groupMap.get(kind) ?? [] }))
    .filter((g) => g.items.length > 0);

  return json({ groups, elapsed_ms: Date.now() - t0 });
};
