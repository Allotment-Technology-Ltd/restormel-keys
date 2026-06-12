/**
 * Post-build step: copies the Vercel Build Output API output to the repo root
 * .vercel/output directory, but only when building for the Vercel adapter.
 *
 * When DEPLOY_TARGET=node (Coolify/Docker builds) the adapter-node output lands
 * directly in apps/dashboard/build — no copy needed and no .vercel dir exists.
 * Skipping prevents the build from failing with "Source not found" on adapter-node.
 *
 * Used by: apps/dashboard package.json build script.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const deployTarget = process.env.DEPLOY_TARGET ?? "vercel";

if (deployTarget === "node") {
  console.log("[post-build] DEPLOY_TARGET=node — skipping Vercel output copy.");
  process.exit(0);
}

// Delegate to the existing vercel-copy-build-output.mjs (same directory as this file).
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
await import(path.join(scriptDir, "vercel-copy-build-output.mjs"));
