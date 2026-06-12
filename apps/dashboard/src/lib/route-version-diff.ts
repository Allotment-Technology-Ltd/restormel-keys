/**
 * Versioned-config intelligence (Stage W3.5) — structural, human-readable diff.
 *
 * INVARIANT: diffs are truthful to the *stored* version snapshots. We diff the
 * `routeSnapshot` + `stepsSnapshot` that the `/history` endpoint returns verbatim
 * from `route_version_events`; nothing here re-derives or approximates a version.
 *
 * The route diff is computed client-side over those snapshots (no route `/diff`
 * endpoint exists — see docs/dashboard-world-class-roadmap.md W3.5 FIRST note).
 * The policy diff is computed server-side (`/api/policies/{id}/diff`) and is
 * normalised into the same `DiffModel` here so a single renderer serves both.
 *
 * Every changed row carries a `fieldPath` so the renderer can deep-link the
 * operator to the field it changed in the builder (rubric X4 — link grammar).
 */

/** One field-level change within a row. */
export type FieldChange = {
  /** Operator-facing field label, e.g. "Model", "Timeout (ms)". */
  label: string;
  /**
   * Machine path used for deep-linking into the builder, e.g.
   * `route.name`, `step.<orderIndex>.modelId`, `policy.ruleDefinition`.
   */
  fieldPath: string;
  /** Previous value, already display-coerced (null when absent). */
  from: string | null;
  /** Next value, already display-coerced (null when absent). */
  to: string | null;
};

export type DiffRowKind = "added" | "removed" | "changed";

/** A diff row: a step, a metadata group, or a policy field group. */
export type DiffRow = {
  kind: DiffRowKind;
  /** Operator-facing title, e.g. "Step 2 — openai/gpt-4o" or "Route metadata". */
  title: string;
  /**
   * Path to the row's anchor in the builder for the "open in builder" link.
   * For a step row this is `step.<orderIndex>`; for metadata it is `route` /
   * `policy`. Empty string means "no deep link" (e.g. a removed step).
   */
  anchorPath: string;
  /** Field-level changes (empty for pure added/removed rows that carry a summary instead). */
  changes: FieldChange[];
};

export type DiffModel = {
  /** Entity noun for copy, "route" | "policy". */
  entity: "route" | "policy";
  fromVersion: number | null;
  toVersion: number | null;
  rows: DiffRow[];
  /** True when from/to are structurally identical. */
  empty: boolean;
};

// --- value coercion -------------------------------------------------------

/** Coerce any stored value to a stable, human-readable string (or null when absent). */
export function displayValue(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") return v.length ? v : null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function stableStringify(v: unknown): string {
  if (v === undefined) return "null";
  try {
    return JSON.stringify(v) ?? "null";
  } catch {
    return String(v);
  }
}

function eq(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

// --- route step / metadata field maps -------------------------------------

/** Step fields shown in the diff, in display order, with operator labels. */
const STEP_FIELDS: { key: string; label: string }[] = [
  { key: "providerPreference", label: "Provider" },
  { key: "modelId", label: "Model" },
  { key: "fallbackOn", label: "Fallback when" },
  { key: "timeoutMs", label: "Timeout (ms)" },
  { key: "enabled", label: "Enabled" },
  { key: "label", label: "Label" },
  { key: "conditionBlock", label: "Condition" },
  { key: "switchCriteria", label: "Switch criteria" },
  { key: "retryPolicy", label: "Retry policy" },
  { key: "costPolicy", label: "Cost policy" },
  { key: "modelPool", label: "Model pool" },
  { key: "parallelGroupId", label: "Parallel group" },
  { key: "parallelBranchRole", label: "Parallel branch role" },
  { key: "notes", label: "Notes" },
];

/** Route metadata fields shown in the diff. Version/hash/timestamps are excluded — they always change. */
const ROUTE_META_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
  { key: "billingMode", label: "Billing mode" },
  { key: "routeMode", label: "Route mode" },
  { key: "defaultModelId", label: "Default model" },
  { key: "workload", label: "Workload" },
  { key: "stage", label: "Stage" },
  { key: "enabled", label: "Enabled" },
];

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function stepKey(step: Record<string, unknown>): string {
  // Prefer a stable id; fall back to order index so a diff still aligns rows.
  if (typeof step.id === "string" && step.id.trim()) return `id:${step.id.trim()}`;
  return `order:${Number(step.orderIndex ?? 0)}`;
}

function stepTitle(step: Record<string, unknown>): string {
  const order = Number(step.orderIndex ?? 0);
  const provider = typeof step.providerPreference === "string" ? step.providerPreference : "";
  const model = typeof step.modelId === "string" ? step.modelId : "";
  const label = typeof step.label === "string" && step.label.trim() ? step.label.trim() : "";
  const ident = [provider, model].filter(Boolean).join("/");
  const head = label || ident || "step";
  return `Step ${order + 1} — ${head}`;
}

// --- route diff (client-side, over stored snapshots) -----------------------

/**
 * Build a structural diff between two route version snapshots.
 *
 * `from` / `to` are `{ routeSnapshot, stepsSnapshot }` objects exactly as the
 * `/history` endpoint returns them. A malformed snapshot (missing object/array)
 * is tolerated — it is treated as empty so the renderer never throws.
 */
export function buildRouteDiff(
  from: { routeSnapshot?: unknown; stepsSnapshot?: unknown; version?: number | null } | null | undefined,
  to: { routeSnapshot?: unknown; stepsSnapshot?: unknown; version?: number | null } | null | undefined
): DiffModel {
  const fromRoute = asRecord(from?.routeSnapshot);
  const toRoute = asRecord(to?.routeSnapshot);
  const fromSteps = Array.isArray(from?.stepsSnapshot)
    ? (from!.stepsSnapshot as unknown[]).map(asRecord)
    : [];
  const toSteps = Array.isArray(to?.stepsSnapshot)
    ? (to!.stepsSnapshot as unknown[]).map(asRecord)
    : [];

  const rows: DiffRow[] = [];

  // 1. Route metadata changes (one grouped row).
  const metaChanges: FieldChange[] = [];
  for (const { key, label } of ROUTE_META_FIELDS) {
    if (!eq(fromRoute[key], toRoute[key])) {
      metaChanges.push({
        label,
        fieldPath: `route.${key}`,
        from: displayValue(fromRoute[key]),
        to: displayValue(toRoute[key]),
      });
    }
  }
  if (metaChanges.length > 0) {
    rows.push({ kind: "changed", title: "Route metadata", anchorPath: "route", changes: metaChanges });
  }

  // 2. Step-level diff, keyed by id (or order index fallback).
  const fromByKey = new Map(fromSteps.map((s) => [stepKey(s), s] as const));
  const toByKey = new Map(toSteps.map((s) => [stepKey(s), s] as const));

  // Removed steps (present in from, absent in to).
  for (const [key, step] of fromByKey) {
    if (!toByKey.has(key)) {
      rows.push({ kind: "removed", title: stepTitle(step), anchorPath: "", changes: [] });
    }
  }
  // Added + changed steps, in `to` order.
  for (const [key, toStep] of toByKey) {
    const order = Number(toStep.orderIndex ?? 0);
    const anchorPath = `step.${order}`;
    const fromStep = fromByKey.get(key);
    if (!fromStep) {
      rows.push({ kind: "added", title: stepTitle(toStep), anchorPath, changes: [] });
      continue;
    }
    const changes: FieldChange[] = [];
    for (const { key: fkey, label } of STEP_FIELDS) {
      if (!eq(fromStep[fkey], toStep[fkey])) {
        changes.push({
          label,
          fieldPath: `${anchorPath}.${fkey}`,
          from: displayValue(fromStep[fkey]),
          to: displayValue(toStep[fkey]),
        });
      }
    }
    if (changes.length > 0) {
      rows.push({ kind: "changed", title: stepTitle(toStep), anchorPath, changes });
    }
  }

  return {
    entity: "route",
    fromVersion: from?.version ?? null,
    toVersion: to?.version ?? null,
    rows,
    empty: rows.length === 0,
  };
}

// --- policy diff (normalise the server /diff payload) ----------------------

/** Operator-facing labels for known policy fields; unknown keys fall back to the raw key. */
const POLICY_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  type: "Type",
  status: "Status",
  ruleDefinition: "Rule definition",
  changeSummary: "Change summary",
};

export type PolicyDiffChange = { field: string; from: unknown; to: unknown };

/**
 * Normalise the policy `/diff` endpoint payload (`{ changes:[{field,from,to}] }`)
 * into the shared `DiffModel`. Each change becomes one field row under a single
 * "Policy" group so the renderer treats routes and policies identically.
 * Version/content-hash/timestamp churn is filtered (always changes on publish).
 */
const POLICY_NOISE_FIELDS = new Set([
  "version",
  "publishedVersion",
  "contentHash",
  "updatedAt",
  "createdAt",
  "updatedVia",
  "updatedBy",
]);

export function buildPolicyDiff(
  changes: PolicyDiffChange[] | null | undefined,
  fromVersion: number | null,
  toVersion: number | null
): DiffModel {
  const list = Array.isArray(changes) ? changes : [];
  const fieldChanges: FieldChange[] = list
    .filter((c) => c && typeof c.field === "string" && !POLICY_NOISE_FIELDS.has(c.field))
    .map((c) => ({
      label: POLICY_FIELD_LABELS[c.field] ?? c.field,
      fieldPath: `policy.${c.field}`,
      from: displayValue(c.from),
      to: displayValue(c.to),
    }));

  const rows: DiffRow[] =
    fieldChanges.length > 0
      ? [{ kind: "changed", title: "Policy", anchorPath: "policy", changes: fieldChanges }]
      : [];

  return { entity: "policy", fromVersion, toVersion, rows, empty: rows.length === 0 };
}

// --- summary (for the publish/rollback confirm) ----------------------------

/**
 * One-line, plain-English summary of a diff, e.g.
 * "3 steps changed, 1 step added" or "No changes between the selected versions".
 * Used in the publish confirm ("Publishing changes 3 steps…") and as the
 * compare panel sub-head.
 */
export function summarizeDiff(model: DiffModel): string {
  if (model.empty) return "No changes between the selected versions.";

  let added = 0;
  let removed = 0;
  let changedSteps = 0;
  let metaChanged = false;

  for (const row of model.rows) {
    if (row.anchorPath === "route" || row.anchorPath === "policy") {
      metaChanged = true;
      continue;
    }
    if (row.kind === "added") added += 1;
    else if (row.kind === "removed") removed += 1;
    else changedSteps += 1;
  }

  const parts: string[] = [];
  const stepNoun = model.entity === "policy" ? "field" : "step";
  if (changedSteps > 0) parts.push(`${changedSteps} ${stepNoun}${changedSteps === 1 ? "" : "s"} changed`);
  if (added > 0) parts.push(`${added} ${stepNoun}${added === 1 ? "" : "s"} added`);
  if (removed > 0) parts.push(`${removed} ${stepNoun}${removed === 1 ? "" : "s"} removed`);
  if (metaChanged) {
    const metaNoun = model.entity === "policy" ? "rule details" : "route metadata";
    parts.push(`${metaNoun} changed`);
  }

  if (parts.length === 0) return "No changes between the selected versions.";
  return `${parts.join(", ")}.`;
}

// --- export + recommend wiring helpers (pure, testable) --------------------

/** Slugify a route name into a safe `.route-bundle.json` filename. */
export function exportBundleFileName(stem: string): string {
  const base =
    String(stem ?? "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "route";
  return `${base}.route-bundle.json`;
}

export type RouteRecommendation = { id: string; priority: "high" | "medium" | "low"; action: string };

/**
 * Normalise the recommend endpoint payload into a clean, ordered list.
 * We quote the endpoint's recommendations verbatim (no second recommendation
 * model) — only sorting by priority and dropping malformed rows. Invalid input
 * yields an empty list rather than throwing.
 */
export function parseRecommendations(payload: unknown): RouteRecommendation[] {
  const data =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data?: unknown }).data
      : payload;
  const raw =
    data && typeof data === "object" && "recommendations" in data
      ? (data as { recommendations?: unknown }).recommendations
      : undefined;
  if (!Array.isArray(raw)) return [];
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return raw
    .filter(
      (r): r is RouteRecommendation =>
        !!r &&
        typeof r === "object" &&
        typeof (r as RouteRecommendation).id === "string" &&
        typeof (r as RouteRecommendation).action === "string" &&
        ["high", "medium", "low"].includes((r as RouteRecommendation).priority)
    )
    .sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
}
