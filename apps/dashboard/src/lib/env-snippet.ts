function normalizedOrigin(keysBaseUrl: string): string {
  return keysBaseUrl.replace(/\/$/, "");
}

/**
 * Full URL for `POST` policy evaluation (Dashboard API). Use with `RESTORMEL_GATEWAY_KEY` as Bearer.
 * Same value you set as `RESTORMEL_EVALUATE_URL` in apps (e.g. Plot Budget) and MCP `entitlements.check`.
 */
export function restormelEvaluatePolicyUrl(keysBaseUrl: string): string {
  return `${normalizedOrigin(keysBaseUrl)}/keys/dashboard/api/policies/evaluate`;
}

/**
 * Dashboard app base for MCP control-plane tools (`/api/projects/…`). No trailing slash.
 * Not the same string as {@link restormelEvaluatePolicyUrl}.
 */
export function restormelControlPlaneBaseUrl(keysBaseUrl: string): string {
  return `${normalizedOrigin(keysBaseUrl)}/keys/dashboard`;
}

/**
 * Copy-paste env lines for local integration (Gateway Key + project id + site base).
 */
export function gatewayKeyEnvSnippet(gatewayKey: string, projectId: string, keysBaseUrl: string): string {
  const base = normalizedOrigin(keysBaseUrl);
  const evaluateUrl = restormelEvaluatePolicyUrl(keysBaseUrl);
  const controlPlaneBase = restormelControlPlaneBaseUrl(keysBaseUrl);
  return [
    "# Restormel Keys — keep out of git (for example add .env.local to .gitignore)",
    `RESTORMEL_GATEWAY_KEY=${gatewayKey}`,
    `# Same Bearer as Gateway key for MCP control-plane tools and Plot-style “server token” fields`,
    `RESTORMEL_SERVER_TOKEN=${gatewayKey}`,
    `RESTORMEL_PROJECT_ID=${projectId}`,
    `# Site origin (some admin wizards use a single “Restormel URL” field — use this, not the control-plane path)`,
    `RESTORMEL_KEYS_BASE=${base}`,
    `# Dashboard app base for route/policy MCP tools ({base}/api/projects/…). Different from KEYS_BASE alone.`,
    `RESTORMEL_CONTROL_PLANE_URL=${controlPlaneBase}`,
    `# Policy evaluate (POST; Bearer = Gateway key)`,
    `RESTORMEL_EVALUATE_URL=${evaluateUrl}`,
    "",
  ].join("\n");
}

export type CiStagingSnippetOptions = {
  /** Raw Gateway key if user just created it or pasted locally; omit for empty placeholder line. */
  gatewayKey?: string;
  projectId: string;
  /** Single environment CI should target (e.g. Development). Omit if project has no environments yet. */
  environmentId?: string;
  /** Human label for comment (e.g. "Development"). */
  environmentLabel?: string;
  keysBaseUrl: string;
  /** When false, omit RESTORMEL_ENVIRONMENT_ID lines (environments module off). Default true. */
  includeEnvironmentId?: boolean;
};

/**
 * One block for `.env` / secret manager using the same names as GitHub Actions docs (`*_STAGING`).
 * One Gateway key is scoped to the project; environment ID picks which deployment slot validate/resolve use.
 */
export function ciStagingSecretsSnippet(opts: CiStagingSnippetOptions): string {
  const base = normalizedOrigin(opts.keysBaseUrl);
  const evaluateUrl = restormelEvaluatePolicyUrl(opts.keysBaseUrl);
  const controlPlaneBase = restormelControlPlaneBaseUrl(opts.keysBaseUrl);
  const includeEnv = opts.includeEnvironmentId !== false;
  const lines: string[] = [
    "# Restormel Keys — CI / staging (add to .env.local or GitHub Secrets). Do not commit real values.",
    "# One Gateway key is enough for this project. Environment ID chooses dev vs prod slot for API calls — pick one for CI (usually Development).",
    "",
  ];

  if (opts.gatewayKey && opts.gatewayKey.length > 0) {
    lines.push(`RESTORMEL_GATEWAY_KEY_STAGING=${opts.gatewayKey}`);
    lines.push(
      `RESTORMEL_SERVER_TOKEN_STAGING=${opts.gatewayKey}`,
      "# ↑ MCP + Plot-style wizards: server token is usually the same Bearer as the Gateway key (see @restormel/mcp README).",
    );
  } else {
    lines.push(
      "RESTORMEL_GATEWAY_KEY_STAGING=",
      "# ↑ Create a key in “Gateway keys” above, then “Copy full snippet” again — or paste a key temporarily into the field below (not saved).",
      "RESTORMEL_SERVER_TOKEN_STAGING=",
      "# ↑ Set to the same value as RESTORMEL_GATEWAY_KEY_STAGING unless you use a separate server-only token.",
    );
  }

  lines.push(`RESTORMEL_PROJECT_ID_STAGING=${opts.projectId}`);

  if (includeEnv) {
    if (opts.environmentId) {
      lines.push(`RESTORMEL_ENVIRONMENT_ID_STAGING=${opts.environmentId}`);
      if (opts.environmentLabel) {
        lines.push(`# ↑ Environment: ${opts.environmentLabel}`);
      }
    } else {
      lines.push(
        "RESTORMEL_ENVIRONMENT_ID_STAGING=",
        "# ↑ No environments on this project yet — create one or leave unset until ready.",
      );
    }
  }

  lines.push(
    `RESTORMEL_KEYS_BASE_STAGING=${base}`,
    "# ↑ Site origin only. If a wizard asks for one “Restormel URL”, this is it — not the same string as CONTROL_PLANE_URL.",
    `RESTORMEL_CONTROL_PLANE_URL_STAGING=${controlPlaneBase}`,
    "# ↑ Dashboard base for MCP routes.* / policies.* ({base}/api/projects/…). Map to RESTORMEL_CONTROL_PLANE_URL.",
    `RESTORMEL_EVALUATE_URL_STAGING=${evaluateUrl}`,
    "# ↑ Full policy evaluate URL (POST). Map to RESTORMEL_EVALUATE_URL (Plot Budget, MCP entitlements.check).",
    "",
    "# --- Unprefixed names (Plot admin setup wizard, local .env) — same values as above ---",
    `RESTORMEL_KEYS_BASE=${base}`,
    `RESTORMEL_CONTROL_PLANE_URL=${controlPlaneBase}`,
    `RESTORMEL_EVALUATE_URL=${evaluateUrl}`,
  );

  if (opts.gatewayKey && opts.gatewayKey.length > 0) {
    lines.push(`RESTORMEL_GATEWAY_KEY=${opts.gatewayKey}`, `RESTORMEL_SERVER_TOKEN=${opts.gatewayKey}`);
  } else {
    lines.push(
      "RESTORMEL_GATEWAY_KEY=",
      "RESTORMEL_SERVER_TOKEN=",
      "# ↑ Fill from Gateway key once created",
    );
  }

  lines.push(`RESTORMEL_PROJECT_ID=${opts.projectId}`);

  if (includeEnv) {
    if (opts.environmentId) {
      lines.push(`RESTORMEL_ENVIRONMENT_ID=${opts.environmentId}`);
    } else {
      lines.push("RESTORMEL_ENVIRONMENT_ID=");
    }
  }

  lines.push(
    "",
    "# GitHub Actions: map *_STAGING secrets to RESTORMEL_* env vars in the workflow if you use prefixed secret names.",
    "",
  );

  return lines.join("\n");
}
