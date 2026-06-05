#!/usr/bin/env node
/**
 * Weekly threshold evaluator for Connect review signals (Phase 6d).
 * Input: signals JSON file OR --from-db with DATABASE_URL.
 * Golden eval gate: run connect-ingest-quality-auto-merge.mjs --apply after brief.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { exportReviewSignals } from "./connect-review-signal-export.mjs";

const THRESHOLDS = [
  { key: "weak_to_ok", rate: 0.25, minN: 30, action: "relax_validation_template" },
  { key: "unsupported_to_ok", rate: 0.15, minN: 20, action: "tune_extract_conservatism" },
  { key: "ok_to_weak", rate: 0.1, minN: 20, action: "tighten_validation_template" },
  { key: "removed_after_weak", rate: 0.2, minN: 20, action: "shift_remediation_toward_drop" },
];

const THEME_OVERRIDE_RATE = 0.4;
const THEME_OVERRIDE_MIN_N = 15;

const AGREE_DELTAS = new Set(["agree_ok", "agree_weak", "agree_unsupported"]);

/**
 * @param {Array<{
 *   verdict_delta: string;
 *   pack_archetype: string | null;
 *   ai_flag_theme?: string | null;
 *   action_type?: string | null;
 * }>} rows
 */
export function evaluateThresholds(rows) {
  const byArchetype = new Map();
  for (const row of rows) {
    const archetype = row.pack_archetype ?? "generic";
    if (!byArchetype.has(archetype)) {
      byArchetype.set(archetype, { total: 0, deltas: {}, themeOverrides: {} });
    }
    const bucket = byArchetype.get(archetype);
    bucket.total += 1;
    const delta = row.verdict_delta ?? "unknown";
    bucket.deltas[delta] = (bucket.deltas[delta] ?? 0) + 1;

    const isOverride =
      row.action_type === "override" ||
      (!AGREE_DELTAS.has(delta) && delta !== "removed" && !delta.startsWith("removed_after"));
    if (isOverride && row.ai_flag_theme && row.ai_flag_theme !== "other") {
      const theme = row.ai_flag_theme;
      bucket.themeOverrides[theme] = (bucket.themeOverrides[theme] ?? 0) + 1;
    }
  }

  const fired = [];
  for (const [archetype, bucket] of byArchetype) {
    for (const t of THRESHOLDS) {
      const count = bucket.deltas[t.key] ?? 0;
      if (bucket.total < t.minN) continue;
      const rate = count / bucket.total;
      if (rate > t.rate) {
        fired.push({
          archetype,
          threshold: t.key,
          rate: Math.round(rate * 100),
          count,
          total: bucket.total,
          action: t.action,
        });
      }
    }

    for (const [theme, count] of Object.entries(bucket.themeOverrides)) {
      if (bucket.total < THEME_OVERRIDE_MIN_N) continue;
      const rate = count / bucket.total;
      if (rate > THEME_OVERRIDE_RATE) {
        fired.push({
          archetype,
          threshold: `ai_flag_theme:${theme}`,
          rate: Math.round(rate * 100),
          count,
          total: bucket.total,
          action: "add_archetype_guardrail",
        });
      }
    }
  }
  return fired;
}

async function loadRows(argv) {
  if (argv.includes("--from-db")) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error("DATABASE_URL is required with --from-db");
      process.exit(1);
    }
    const days = Number(process.env.SIGNAL_DAYS ?? 7);
    return exportReviewSignals(databaseUrl, days);
  }
  const inputPath = argv.find((a) => !a.startsWith("-"));
  if (!inputPath) {
    console.error(
      "Usage: node scripts/connect-review-signal-thresholds.mjs <signals.json> | --from-db",
    );
    process.exit(1);
  }
  return JSON.parse(readFileSync(inputPath, "utf8"));
}

async function main() {
  const rows = await loadRows(process.argv.slice(2));
  const fired = evaluateThresholds(rows);
  if (fired.length === 0) {
    console.log("No thresholds fired.");
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  const outDir = join(process.cwd(), "docs/restormel/ingest-quality-signals");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${date}-threshold-brief.md`);
  const body = [
    `# Ingest quality threshold brief — ${date}`,
    "",
    "Aggregates only; no user graph content.",
    "",
    ...fired.map(
      (f) =>
        `- **${f.archetype}** — \`${f.threshold}\` at ${f.rate}% (${f.count}/${f.total}) → ${f.action}`,
    ),
    "",
    "Next: apply from Restormel Admin → /keys/admin/ingest-quality (G2 gate required).",
  ].join("\n");
  writeFileSync(outPath, body);
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(fired, null, 2));
  process.exit(2);
}

main();
