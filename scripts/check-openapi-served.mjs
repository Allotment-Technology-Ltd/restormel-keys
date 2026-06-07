#!/usr/bin/env node
/**
 * Drift gate: the OpenAPI spec served to the in-site Scalar API reference
 * (apps/dashboard/static/keys/openapi.json) must be byte-identical to the
 * gateway's source-of-truth spec (zuplo-gateway/config/routes.oas.json).
 *
 * This guarantees the documentation never describes a spec other than what the
 * gateway deploys. The dashboard build regenerates the served copy via
 * scripts/copy-openapi.mjs; this check fails CI if a stale copy is committed.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "zuplo-gateway/config/routes.oas.json");
const served = resolve(root, "apps/dashboard/static/keys/openapi.json");

function read(p, label) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    console.error(`[check-openapi-served] missing ${label}: ${p}`);
    console.error("[check-openapi-served] run: node scripts/copy-openapi.mjs");
    process.exit(1);
  }
}

const a = read(src, "gateway spec");
const b = read(served, "served spec");

if (a !== b) {
  console.error("[check-openapi-served] DRIFT: served openapi.json != gateway routes.oas.json");
  console.error("[check-openapi-served] fix: node scripts/copy-openapi.mjs && commit apps/dashboard/static/keys/openapi.json");
  process.exit(1);
}

console.log("[check-openapi-served] OK — served spec matches the gateway spec");
