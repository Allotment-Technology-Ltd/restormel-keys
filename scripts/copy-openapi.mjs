#!/usr/bin/env node
/**
 * Copy the single source-of-truth gateway OpenAPI spec into the dashboard's
 * static assets so the in-site Scalar API reference renders exactly what the
 * gateway deploys. Run as part of the dashboard build (see apps/dashboard
 * package.json `build`). The CI drift gate (scripts/check-openapi-served.mjs)
 * asserts the committed copy matches the source so docs can never document a
 * spec other than what's deployed.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "zuplo-gateway/config/routes.oas.json");
const dest = resolve(root, "apps/dashboard/static/keys/openapi.json");

const raw = readFileSync(src, "utf8");
// Validate it parses (fail the build early on a malformed spec).
JSON.parse(raw);

mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, raw);

console.log(`[copy-openapi] ${src} -> ${dest} (${raw.length} bytes)`);
