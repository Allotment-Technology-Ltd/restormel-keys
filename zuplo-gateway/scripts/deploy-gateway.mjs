#!/usr/bin/env node
/**
 * Gateway-only deploy for the Restormel Keys Zuplo gateway.
 *
 * The dev portal (zudoku) was retired in favour of the in-site Scalar API
 * reference (restormel.dev/keys/docs/api-reference). With no `docs/` folder,
 * Zuplo SKIPS the dev-portal build stage and deploys only the API gateway —
 * which is what we want, and it avoids the dev-portal build OOM entirely.
 *
 * Quirk: when the dev-portal stage is skipped, `zuplo deploy` still exits 1 even
 * though the gateway deployed successfully. So this wrapper ignores the CLI exit
 * code and instead judges success from the Zuplo API: the deployment's `api`
 * stage must be `success` (a `skipped` or `success` dev-portal stage is fine).
 *
 * Env:
 *   ZUPLO_API_KEY          (required)
 *   ZUPLO_ACCOUNT_NAME     default: silver_profitable_wasp
 *   ZUPLO_PROJECT_NAME     default: restormel-keys-gateway
 *   ZUPLO_ENVIRONMENT      default: main
 *   ZUPLO_DEPLOYMENT_NAME  default: restormel-keys-gateway-main-bc13eba
 */
import { spawnSync } from "node:child_process";

const API_KEY = process.env.ZUPLO_API_KEY;
const ACCOUNT = process.env.ZUPLO_ACCOUNT_NAME || "silver_profitable_wasp";
const PROJECT = process.env.ZUPLO_PROJECT_NAME || "restormel-keys-gateway";
const ENVIRONMENT = process.env.ZUPLO_ENVIRONMENT || "main";
const DEPLOYMENT_NAME = process.env.ZUPLO_DEPLOYMENT_NAME || "restormel-keys-gateway-main-bc13eba";

if (!API_KEY) {
  console.error("[deploy-gateway] Missing ZUPLO_API_KEY");
  process.exit(1);
}

console.log(`[deploy-gateway] deploying ${PROJECT} → environment '${ENVIRONMENT}' (gateway-only; dev portal retired)`);

// Run the CLI; its exit code is unreliable when the dev-portal stage is skipped.
spawnSync(
  "npx",
  ["--yes", "zuplo@^6", "deploy", "--api-key", API_KEY, "--account", ACCOUNT, "--project", PROJECT, "--environment", ENVIRONMENT],
  { stdio: "inherit" },
);

// Judge real success from the Zuplo API.
const url = `https://dev.zuplo.com/v1/deployments/${DEPLOYMENT_NAME}`;
const deadline = Date.now() + 90_000;
let lastStages = "";

while (Date.now() < deadline) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
    if (res.ok) {
      const d = await res.json();
      const stages = d.deploymentVersion?.stages ?? [];
      lastStages = stages.map((s) => `${s.stage}=${s.status}`).join(", ");
      const api = stages.find((s) => s.stage === "api")?.status;
      const devPortal = stages.find((s) => s.stage === "dev-portal")?.status;

      if (api === "success" && (devPortal === undefined || devPortal === "success" || devPortal === "skipped")) {
        console.log(`[deploy-gateway] ✅ gateway deployed — state=${d.state}, stages: ${lastStages}`);
        process.exit(0);
      }
      if (api === "failed" || d.state === "ERRORED") {
        console.error(`[deploy-gateway] ❌ deploy failed — state=${d.state}, stages: ${lastStages}`);
        process.exit(1);
      }
      // otherwise still in progress — keep polling
    }
  } catch (e) {
    console.warn(`[deploy-gateway] status poll error: ${e?.message ?? e}`);
  }
  await new Promise((r) => setTimeout(r, 5000));
}

console.error(`[deploy-gateway] ❌ timed out waiting for api stage success (last: ${lastStages || "no status"})`);
process.exit(1);
