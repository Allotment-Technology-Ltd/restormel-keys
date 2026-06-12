/**
 * Connect run preflight contract (Stage K3 / K-P0-2).
 *
 * Shared by the server preflight module, the launch panel, the ingest-jobs BFF and the
 * project readiness endpoint. Client-safe: types + pure helpers only, no server imports.
 */

/**
 * Why a provider row is failing. The first three mirror runtime-invoke's credential
 * lookup codes; `verification_failed` is the K2 signal — the key decrypts but the
 * provider rejected it on the last real verification probe, so the run would fail
 * upstream mid-flight.
 */
export type ConnectRunPreflightIssueCode =
  | "no_provider_binding"
  | "integration_not_found"
  | "credential_unavailable"
  | "verification_failed";

export type ConnectRunPreflightProviderRow = {
  /** Canonical provider id (openai, anthropic, …) as resolved by stage routes. */
  provider: string;
  /** Connect stages whose routes resolve to this provider. */
  stages: string[];
  /** A provider_bindings row exists on the routing project for this provider. */
  hasBinding: boolean;
  /** The bound integration's hosted credential decrypts (the exact runtime lookup). */
  credentialExecutable: boolean;
  /** Failing reason; null when the row passes. */
  issue: ConnectRunPreflightIssueCode | null;
  /** One-click repair target when exactly one workspace integration matches. */
  bind: { integrationId: string; label: string } | null;
  /** Where to fix it by hand (Connections page / integration detail). */
  fixHref: string;
  fixLabel: string;
};

export type ConnectRunPreflightStatus =
  /** Every stage-route provider has a binding with a decryptable credential. */
  | "pass"
  /** At least one provider is missing a binding or has a dead credential. */
  | "blocked"
  /**
   * No stage routes are configured but a legacy environment LLM key exists —
   * the run executes on the env key. Launch requires an explicit override.
   */
  | "legacy_env";

export type ConnectRunPreflightResult = {
  status: ConnectRunPreflightStatus;
  /** Routing project the run will execute against (null in legacy/unconfigured setups). */
  projectId: string | null;
  environmentId: string | null;
  providers: ConnectRunPreflightProviderRow[];
  /**
   * Machine-readable issue codes: `no_stage_routes`, `legacy_env_key`,
   * `<issue>:<provider>` per failing row, `stage_route_unresolved_model:<stage>` (warning).
   */
  issues: string[];
  checkedAt: string;
};

/** True when the launch gate may proceed (override only unlocks legacy_env). */
export function preflightAllowsLaunch(
  preflight: ConnectRunPreflightResult | null | undefined,
  legacyOverride: boolean,
): boolean {
  if (!preflight) return true; // compute failure never bricks the gate; server re-checks
  if (preflight.status === "pass") return true;
  if (preflight.status === "legacy_env") return legacyOverride;
  return false;
}

/** Rows that should render above START RUN. */
export function failingPreflightRows(
  preflight: ConnectRunPreflightResult | null | undefined,
): ConnectRunPreflightProviderRow[] {
  return (preflight?.providers ?? []).filter((r) => r.issue !== null);
}

/** Operator copy per failing row — shared by the launch panel and the run console. */
export function preflightIssueCopy(row: ConnectRunPreflightProviderRow): string {
  switch (row.issue) {
    case "no_provider_binding":
      return `No ${row.provider} connection is bound to your routing project — the run would fail when the ${row.stages.join(", ")} stage${row.stages.length === 1 ? "" : "s"} call${row.stages.length === 1 ? "s" : ""} the provider.`;
    case "integration_not_found":
      return `The ${row.provider} binding points at a connection that no longer exists in this workspace.`;
    case "credential_unavailable":
      return `Your stored ${row.provider} key can't be decrypted — re-enter it to make it executable.`;
    case "verification_failed":
      return `${row.provider} rejected your stored key on the last verification — re-verify or replace it before running.`;
    default:
      return `${row.provider} is ready.`;
  }
}

/** Human rendering of a known worker failure (K-P2-1) — null for unrecognized errors. */
export type ConnectRunFailureHelp = {
  title: string;
  body: string;
  fixHref: string;
  fixLabel: string;
};

/**
 * Map a raw `job.error` string from the ingest worker onto plain-language copy with a
 * repair link. Known shapes:
 *  - "Provider credentials missing (no_provider_binding|integration_not_found|credential_unavailable)"
 *    (stage-route-generate wrapping runtime-invoke's lookup codes)
 *  - "Provider <p> is not OpenAI-compatible for Knowledge ingestion yet"
 *  - "Embedding via <p> is not supported in Connect ingest yet — …"
 * Unknown errors return null and render raw, as before.
 */
export function mapConnectRunFailure(
  error: string | null | undefined,
  base: string,
): ConnectRunFailureHelp | null {
  if (!error) return null;
  const connectionsHref = `${base}/integrations`;
  const modelsHref = `${base}/connect/models`;

  const credCode = /provider credentials missing \((no_provider_binding|integration_not_found|credential_unavailable)\)/i.exec(error)?.[1];
  if (credCode === "no_provider_binding") {
    return {
      title: "Provider not bound to your routing project",
      body: "The run resolved a provider that has no connection bound to the project your stage routes execute against. Bind your provider connection to the project, then restart the run.",
      fixHref: connectionsHref,
      fixLabel: "Open Connections",
    };
  }
  if (credCode === "integration_not_found") {
    return {
      title: "Bound provider connection no longer exists",
      body: "The project's provider binding points at a connection that was removed from this workspace. Reconnect the provider and bind it to the project, then restart the run.",
      fixHref: connectionsHref,
      fixLabel: "Open Connections",
    };
  }
  if (credCode === "credential_unavailable") {
    return {
      title: "Stored provider key can't be decrypted",
      body: "The provider connection exists but its stored key is not executable (missing or rotated encryption key). Re-enter the API key on the connection, then restart the run.",
      fixHref: connectionsHref,
      fixLabel: "Re-enter key",
    };
  }
  if (/is not openai-compatible/i.test(error)) {
    return {
      title: "Stage route resolves to an unsupported chat provider",
      body: "A stage route's primary model belongs to a provider Knowledge ingestion can't call yet. Point the stage at an OpenAI-compatible provider under Models.",
      fixHref: modelsHref,
      fixLabel: "Open Models",
    };
  }
  if (/embedding via .* is not supported/i.test(error)) {
    return {
      title: "Embedding route resolves to an unsupported provider",
      body: "The embedding stage route resolves to a provider without embedding support in Connect ingest. Use openai, voyage, together, or vercel for the embedding stage under Models.",
      fixHref: modelsHref,
      fixLabel: "Open Models",
    };
  }
  return null;
}
