#!/usr/bin/env node
/**
 * Validate registry files (no dependencies).
 *
 * This is intentionally strict and CI-friendly:
 * - exits 0 when registry is valid
 * - exits 1 when registry is invalid
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, "registry", "models.json");

function fail(msg) {
  process.stderr.write(`[registry] ${msg}\n`);
  process.exitCode = 1;
}

function isPlainObject(v) {
  return typeof v === "object" && v != null && !Array.isArray(v);
}

function isIsoDate(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
}

async function main() {
  if (!existsSync(REGISTRY_PATH)) {
    fail(`missing file: ${REGISTRY_PATH}`);
    return;
  }

  let data;
  try {
    const raw = await readFile(REGISTRY_PATH, "utf-8");
    data = JSON.parse(raw);
  } catch (e) {
    fail(`failed to read/parse registry/models.json: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  if (!isPlainObject(data)) {
    fail("registry root must be an object");
    return;
  }

  if (data.version !== 1) fail("registry.version must be 1");
  if (!isIsoDate(data.lastUpdatedAt)) fail("registry.lastUpdatedAt must be an ISO date string (YYYY-MM-DD...)");
  if (!Array.isArray(data.models)) fail("registry.models must be an array");

  const allowedLifecycle = new Set(["active", "deprecated", "sunset", "removed"]);
  const seenIds = new Set();

  for (const [i, m] of (data.models ?? []).entries()) {
    if (!isPlainObject(m)) {
      fail(`models[${i}] must be an object`);
      continue;
    }
    if (typeof m.id !== "string" || !m.id.trim()) fail(`models[${i}].id must be a non-empty string`);
    if (typeof m.lifecycle !== "string" || !allowedLifecycle.has(m.lifecycle)) {
      fail(`models[${i}].lifecycle must be one of: ${[...allowedLifecycle].join(", ")}`);
    }
    if (m.providers != null) {
      if (!Array.isArray(m.providers) || m.providers.some((p) => typeof p !== "string" || !p.trim())) {
        fail(`models[${i}].providers must be an array of strings when present`);
      }
    }
    for (const k of ["deprecatedAt", "sunsetAt"] ) {
      if (m[k] != null && !isIsoDate(m[k])) fail(`models[${i}].${k} must be an ISO date string when present`);
    }
    if (m.replacedBy != null && typeof m.replacedBy !== "string") {
      fail(`models[${i}].replacedBy must be a string when present`);
    }

    const norm = typeof m.id === "string" ? m.id.toLowerCase() : String(i);
    if (seenIds.has(norm)) fail(`duplicate model id: ${m.id}`);
    seenIds.add(norm);
  }

  if (process.exitCode === 1) return;
  process.stdout.write("[registry] OK\n");
}

await main();

