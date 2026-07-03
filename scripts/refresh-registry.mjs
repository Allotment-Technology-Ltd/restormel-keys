#!/usr/bin/env node
/**
 * Best-effort registry refresh.
 *
 * This is intentionally conservative:
 * - Only updates registry metadata when live fetches succeed.
 * - Does NOT ingest full model lists (too noisy for now).
 *
 * Configure secrets (optional):
 * - OPENROUTER_API_KEY
 * - PORTKEY_API_KEY
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, "registry", "models.json");

function today() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchOk(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  // drain body to completion
  await res.arrayBuffer();
}

async function main() {
  if (!existsSync(REGISTRY_PATH)) {
    process.stderr.write(`[registry] missing ${REGISTRY_PATH}\n`);
    process.exit(1);
  }

  const raw = await readFile(REGISTRY_PATH, "utf-8");
  const registry = JSON.parse(raw);

  let changed = false;
  const sources = registry.sources && typeof registry.sources === "object" ? registry.sources : {};
  const nextSources = { ...sources };

  // OpenRouter (requires key)
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    await fetchOk("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${openrouterKey}` },
    });
    nextSources.openrouter = { lastFetchedAt: new Date().toISOString() };
    changed = true;
  }

  // Portkey (requires key)
  const portkeyKey = process.env.PORTKEY_API_KEY;
  if (portkeyKey) {
    await fetchOk("https://api.portkey.ai/v1/models", {
      method: "GET",
      headers: { "x-portkey-api-key": portkeyKey },
    });
    nextSources.portkey = { lastFetchedAt: new Date().toISOString() };
    changed = true;
  }

  if (!changed) {
    process.stdout.write("[registry] No live sources configured; no changes.\n");
    return;
  }

  registry.sources = nextSources;
  registry.lastUpdatedAt = today();

  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n", "utf-8");
  process.stdout.write("[registry] Updated registry metadata.\n");
}

await main();

