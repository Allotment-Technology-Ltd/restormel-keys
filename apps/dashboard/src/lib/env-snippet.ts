/**
 * Copy-paste env lines for local integration (Gateway Key + project id + site base).
 */
export function gatewayKeyEnvSnippet(gatewayKey: string, projectId: string, keysBaseUrl: string): string {
  const base = keysBaseUrl.replace(/\/$/, "");
  return [
    "# Restormel Keys — keep out of git (for example add .env.local to .gitignore)",
    `RESTORMEL_GATEWAY_KEY=${gatewayKey}`,
    `RESTORMEL_PROJECT_ID=${projectId}`,
    `RESTORMEL_KEYS_BASE=${base}`,
    "",
  ].join("\n");
}
