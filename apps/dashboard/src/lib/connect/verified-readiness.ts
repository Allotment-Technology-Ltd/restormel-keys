/**
 * "Ready to verify" readiness ledger contract (Stage K4 / review §3 coherence thesis).
 *
 * ONE readiness model answering "will my next Connect run produce verified context?":
 * gateway key · decryptable provider families (cross-model) · stage routes ·
 * provider→project binding · encryption · graph store & documents.
 *
 * Shared by the server readiness module, the Connect hub ledger panel, the hub
 * journey's ai_keys step detail, and the Overview summary chip.
 * Client-safe: types + pure helpers only, no server imports.
 */

export type ConnectReadinessRowId =
  | "gateway_key"
  | "provider_families"
  | "stage_routes"
  | "provider_binding"
  | "encryption"
  | "store_documents";

export type ConnectReadinessStatus = "ok" | "warn" | "fail";

export type ConnectReadinessRow = {
  id: ConnectReadinessRowId;
  /** Short mono label, e.g. "Provider families". */
  label: string;
  status: ConnectReadinessStatus;
  /** Receipt line, e.g. "2 families: anthropic, openai — cross-model validation on". */
  evidence: string;
  /** Deep-link to the exact repair; null when the row passes and needs no action. */
  fixHref: string | null;
  fixLabel: string | null;
};

export type ConnectVerifiedReadiness = {
  rows: ConnectReadinessRow[];
  /** Rows with status ok. */
  ready: number;
  total: number;
  /** Worst row status: any fail → fail, else any warn → warn, else ok. */
  status: ConnectReadinessStatus;
  checkedAt: string;
  /**
   * Stage-route sub-signals quoted by the hub journey phase/steps — the same
   * computation that feeds the stage_routes row (no second readiness model).
   */
  models: { modelsReady: boolean; hasChatRoute: boolean; hasEmbeddingRoute: boolean };
};

/** Anchor id of the hub ledger panel — launch preflight and run-failure surfaces link here. */
export const CONNECT_READINESS_ANCHOR = "readiness";

/** Href of the standing hub ledger panel, e.g. "/keys/dashboard/connect#readiness". */
export function connectReadinessHubHref(dashboardBase: string): string {
  return `${dashboardBase}/connect#${CONNECT_READINESS_ANCHOR}`;
}

export function overallReadinessStatus(
  rows: Pick<ConnectReadinessRow, "status">[],
): ConnectReadinessStatus {
  if (rows.some((r) => r.status === "fail")) return "fail";
  if (rows.some((r) => r.status === "warn")) return "warn";
  return "ok";
}

/** Overview checklist chip + hub badge copy: "Connect: 4/6 ready". */
export function readinessChipLabel(
  readiness: Pick<ConnectVerifiedReadiness, "ready" | "total">,
): string {
  return `Connect: ${readiness.ready}/${readiness.total} ready`;
}

/**
 * The hub journey's ai_keys step detail consumes the SAME summary as the ledger
 * (no second readiness model). Null when readiness could not be computed so the
 * caller can fall back to legacy copy.
 */
export function readinessStepDetail(
  readiness: Pick<ConnectVerifiedReadiness, "rows" | "ready" | "total"> | null | undefined,
): string | null {
  if (!readiness) return null;
  if (readiness.ready === readiness.total) {
    return `Ready to verify — all ${readiness.total} readiness checks pass`;
  }
  const next = readiness.rows.find((row) => row.status !== "ok");
  return `${readiness.ready}/${readiness.total} readiness checks pass${
    next ? ` — next: ${next.label.toLowerCase()}` : ""
  }`;
}

/**
 * Panel render state (ux-contracts §3) — pure so the matrix is unit-testable.
 * `null` readiness while signed in means the server compute failed → error state
 * with a recovery action, never a silent blank.
 */
export type ReadinessPanelState = "signed_out" | "error" | "ledger";

export function resolveReadinessPanelState(
  signedIn: boolean,
  readiness: ConnectVerifiedReadiness | null | undefined,
): ReadinessPanelState {
  if (!signedIn) return "signed_out";
  if (!readiness) return "error";
  return "ledger";
}

/**
 * Fix-link routing for `api/projects/[id]/readiness` issue codes — the project
 * detail card renders each issue as a receipt with a repair link (K-P1-5).
 * Connect-preflight codes (`connect_run_*`) get their precise links from the
 * embedded `connect_run_preflight` rows; this covers the project-level codes.
 */
export function projectReadinessIssueFix(
  code: string,
  projectId: string,
  dashboardBase: string,
): { href: string; label: string } | null {
  switch (code) {
    case "no_provider_bindings":
      return { href: `${dashboardBase}/integrations`, label: "Open Connections" };
    case "no_routes":
    case "routes_without_enabled_steps":
      return { href: `${dashboardBase}/projects/${projectId}/routes`, label: "Open Routes" };
    case "no_project_policy_binding":
      return { href: `${dashboardBase}/policies`, label: "Open Policies" };
    case "connect_run_no_stage_routes":
      return { href: `${dashboardBase}/connect/models`, label: "Configure routes" };
    default:
      return null;
  }
}
