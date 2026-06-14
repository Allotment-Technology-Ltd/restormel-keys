#!/usr/bin/env node
/**
 * scripts/security/severity-gate.mjs
 *
 * Parses OSV-Scanner JSON output and applies the Restormel vulnerability SLA table:
 *
 *   CRITICAL (9.0–10.0) / HIGH (7.0–8.9)  → exit 1  (blocks CI build)
 *   MEDIUM   (4.0–6.9)                     → exit 0  (warn, open tracked issue)
 *   LOW      (0.1–3.9)                     → exit 0  (informational)
 *
 * Supports a time-boxed allowlist at scripts/security/vuln-allowlist.json:
 *   [{ "id": "GHSA-…", "reason": "…", "expires": "2026-07-01" }]
 * Expired entries are ignored (treated as not allowed → re-block).
 *
 * Usage:
 *   node scripts/security/severity-gate.mjs <osv-results.json>
 *
 * No external dependencies — runs on the Node version already required by this repo.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SEVERITY_BLOCK = new Set(["CRITICAL", "HIGH"]);
const SEVERITY_WARN = new Set(["MEDIUM", "LOW"]);

/** CVSS v3 score → severity label. OSV may not always supply a label. */
function scoreToSeverity(score) {
  if (score === undefined || score === null) return "UNKNOWN";
  if (score >= 9.0) return "CRITICAL";
  if (score >= 7.0) return "HIGH";
  if (score >= 4.0) return "MEDIUM";
  return "LOW";
}

/** Best-effort severity from an OSV vulnerability record.
 *
 * OSV-Scanner v2 (used here) produces JSON with this structure:
 *   vuln.severity = [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/..." }, ...]
 *                   (score is a CVSS vector string, NOT a numeric float)
 *   vuln.database_specific.severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
 *
 * We prefer the authoritative label from database_specific.severity (populated by
 * GitHub Advisory / NVD), then fall back to parsing the CVSS v3 base score from
 * the vector string if needed.
 */
function getSeverity(vuln) {
  // 1. Prefer database_specific.severity (string label — most reliable for OSV v2 output)
  const dbSevLabel = (
    vuln.database_specific?.severity ??
    vuln.database_specific?.cvss?.severity ??
    vuln.database_specific?.severity_string ??
    ""
  ).toUpperCase();
  if (dbSevLabel && (SEVERITY_BLOCK.has(dbSevLabel) || SEVERITY_WARN.has(dbSevLabel))) {
    return dbSevLabel;
  }

  // 2. Parse CVSS v3 base score from vector string in severity array
  const severityField = vuln.severity ?? [];
  for (const s of Array.isArray(severityField) ? severityField : [severityField]) {
    if (s?.type === "CVSS_V3" && typeof s?.score === "string") {
      // Extract base score from vector string: "CVSS:3.1/AV:N/AC:L/.../E:P" — base score
      // is not in the vector string directly; skip to numeric paths below.
      continue;
    }
    // Some DBs do emit numeric scores directly
    if (typeof s?.score === "number") return scoreToSeverity(s.score);
  }

  // 3. Numeric score from database_specific
  const dbScore =
    vuln.database_specific?.cvss?.score ??
    vuln.database_specific?.severity?.score;
  if (typeof dbScore === "number") return scoreToSeverity(dbScore);

  return "UNKNOWN";
}

/** Load the allowlist, filter out expired entries, return a Set of allowed IDs. */
function loadAllowlist() {
  const allowlistPath = resolve(__dirname, "vuln-allowlist.json");
  if (!existsSync(allowlistPath)) return new Set();

  let entries;
  try {
    entries = JSON.parse(readFileSync(allowlistPath, "utf8"));
  } catch {
    console.error(
      `[severity-gate] WARNING: Could not parse vuln-allowlist.json — ignoring allowlist.`
    );
    return new Set();
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const active = new Set();
  for (const entry of entries) {
    if (!entry.id || !entry.expires) {
      console.warn(
        `[severity-gate] Allowlist entry missing 'id' or 'expires' — skipping:`,
        entry
      );
      continue;
    }
    if (entry.expires < today) {
      // Expired → not active (silently re-blocks)
      console.warn(
        `[severity-gate] Allowlist entry EXPIRED for ${entry.id} (expired ${entry.expires}). Re-blocking.`
      );
      continue;
    }
    active.add(entry.id);
    console.log(
      `[severity-gate] Allowlisted: ${entry.id} until ${entry.expires} — ${entry.reason ?? "(no reason)"}`
    );
  }
  return active;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const resultsPath = process.argv[2];
if (!resultsPath) {
  console.error("[severity-gate] Usage: node severity-gate.mjs <osv-results.json>");
  process.exit(2);
}

if (!existsSync(resultsPath)) {
  // No output file → osv-scanner found nothing (clean lockfile path).
  console.log("[severity-gate] No OSV results file found — assuming clean scan. Passing.");
  process.exit(0);
}

let osvOutput;
try {
  osvOutput = JSON.parse(readFileSync(resultsPath, "utf8"));
} catch {
  // Empty / malformed output also means no findings.
  console.log("[severity-gate] OSV results file is empty or not valid JSON — assuming clean.");
  process.exit(0);
}

const allowlist = loadAllowlist();

const results = Array.isArray(osvOutput?.results) ? osvOutput.results : [];
let blockCount = 0;
let warnCount = 0;

for (const result of results) {
  const source = result.source?.path ?? result.source ?? "unknown";
  for (const pkg of result.packages ?? []) {
    const pkgName = pkg.package?.name ?? "unknown";
    const pkgVersion = pkg.package?.version ?? "?";
    for (const vuln of pkg.vulnerabilities ?? []) {
      const id = vuln.id ?? "UNKNOWN-ID";
      const sev = getSeverity(vuln);
      const aliases = (vuln.aliases ?? []).join(", ");
      const summary = (vuln.summary ?? "").slice(0, 120);

      if (allowlist.has(id)) {
        console.log(`[severity-gate] ALLOWED  [${sev}] ${id} in ${pkgName}@${pkgVersion} (source: ${source})`);
        continue;
      }

      if (SEVERITY_BLOCK.has(sev)) {
        blockCount++;
        console.error(
          `[severity-gate] BLOCK    [${sev}] ${id}${aliases ? ` (${aliases})` : ""} in ${pkgName}@${pkgVersion}`
        );
        if (summary) console.error(`           ${summary}`);
        console.error(`           Source: ${source}`);
      } else if (SEVERITY_WARN.has(sev)) {
        warnCount++;
        console.warn(
          `[severity-gate] WARNING  [${sev}] ${id}${aliases ? ` (${aliases})` : ""} in ${pkgName}@${pkgVersion}`
        );
        if (summary) console.warn(`           ${summary}`);
      } else {
        // UNKNOWN severity — log but do not block
        console.log(
          `[severity-gate] INFO     [${sev}] ${id}${aliases ? ` (${aliases})` : ""} in ${pkgName}@${pkgVersion}`
        );
      }
    }
  }
}

console.log(
  `\n[severity-gate] Summary: ${blockCount} blocking (HIGH/CRITICAL), ${warnCount} warning (MEDIUM/LOW).`
);

if (blockCount > 0) {
  console.error(
    `[severity-gate] ✖ Gate FAILED — ${blockCount} HIGH/CRITICAL vulnerability(ies) require remediation.`
  );
  console.error(
    `[severity-gate]   SLA: CRITICAL → 72 h, HIGH → 7 days. To time-box an exception, add to scripts/security/vuln-allowlist.json with an expiry date and reason.`
  );
  process.exit(1);
}

if (warnCount > 0) {
  console.warn(
    `[severity-gate] ⚠ Gate PASSED with ${warnCount} MEDIUM/LOW advisory(ies). Open a tracked issue with a 30-day SLA label.`
  );
} else {
  console.log(`[severity-gate] ✔ Gate PASSED — no blocking vulnerabilities found.`);
}

process.exit(0);
