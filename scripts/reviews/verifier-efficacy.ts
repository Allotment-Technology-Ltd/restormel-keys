/**
 * Verifier efficacy harness (Verified Context roadmap, Stage 1.0a).
 *
 * Measures the CURRENT validation stage against ground truth: labeled claims (supported +
 * planted fabricated/overstated/misattributed) are validated through the REAL
 * validateUnitsBatch path; verdicts are scored against the labels. Omissions are tracked
 * explicitly and never counted as catches (see verifier-efficacy.ts).
 *
 * Cross-model design (adapter mode, product-owner approved 2026-06-09): per-stage
 * ExtractionGenerate functions are bound directly to provider APIs — extraction to family
 * A, validation to family B — exercising the same prompts/parse/coverage code that ships,
 * while skipping only the dashboard's route-resolution plumbing.
 *
 * Modes
 *   default            validate the labeled claims directly against each cited source
 *   --with-extraction  first run real extractGraph (extractor family) on each source, then
 *                      validate planted claims MIXED among extracted units — realistic
 *                      batch composition; the cross-model vs same-model delta comes from
 *                      pairing validator families against the fixed extractor family.
 *   --ebv              Stage 1.0d before/after: ALSO run the EBV Layer 1+2 path — quote
 *                      retrieval (extractor family, mirrors the extraction evidence
 *                      contract) → deterministic binding → span-scoped entailment
 *                      (validator family) — and report both paths side by side with
 *                      call/char cost counters. A coverage-gap abstention scores as
 *                      "omitted" (never a catch); a structural no-bind scores as a flag.
 *
 * Usage (keys via env: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY|GEMINI_API_KEY):
 *   pnpm exec tsx scripts/reviews/verifier-efficacy.ts \
 *     --validator openai:gpt-4o-mini --validator anthropic:claude-haiku-4-5-20251001 \
 *     --extractor openai:gpt-4o-mini --runs 3 --with-extraction \
 *     --out scripts/reviews/verifier-efficacy-results.json
 *
 * This is a MEASUREMENT AID with live-model cost. Exit code 0 unless the harness itself
 * fails; quality bars are proposed by humans from the numbers, not enforced here.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { ExtractionGenerate } from "../../packages/connect-core/src/ingest/extract.js";
import { extractGraph } from "../../packages/connect-core/src/ingest/extract.js";
import type { ValidationInput } from "../../packages/connect-core/src/ingest/validation.js";
import {
  aggregateRuns,
  collectValidationVerdicts,
  scoreOutcomes,
  validateEfficacyFixture,
  type ClaimVerdict,
  type EfficacyFixture,
  type EfficacyRunResult,
} from "../../packages/connect-core/src/ingest/verifier-efficacy.js";
import {
  bindEvidenceSpan,
  contentHash,
  type EvidenceBinding,
} from "../../packages/connect-core/src/ingest/evidence-binding.js";
import {
  judgeEntailment,
  type UnitEntailment,
} from "../../packages/connect-core/src/ingest/entailment.js";
// Imported from contracts SOURCE (not the package subpath): tsx resolves this script's
// chain under CJS conditions, and @restormel/contracts exports only types/import.
import { PHILOSOPHY_DOMAIN_PACK } from "../../packages/contracts/src/connect.js";

type ModelSpec = { family: "openai" | "anthropic" | "google" | "together"; model: string };

const DEFAULT_MODELS: Record<ModelSpec["family"], string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  google: "gemini-2.0-flash",
  // Together serves open-weights families (Llama/Qwen/DeepSeek/…) behind one key — a
  // genuinely different model family from an OpenAI extractor for the cross check.
  // Override via together:<any Together chat model id>.
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
};

function parseSpec(raw: string): ModelSpec {
  const [family, ...rest] = raw.split(":");
  if (family !== "openai" && family !== "anthropic" && family !== "google" && family !== "together") {
    throw new Error(`Unknown family "${family}" (use openai|anthropic|google|together[:model])`);
  }
  return { family, model: rest.join(":") || DEFAULT_MODELS[family] };
}

function requireEnv(name: string, alt?: string): string {
  const v = process.env[name]?.trim() || (alt ? process.env[alt]?.trim() : undefined);
  if (!v) throw new Error(`Missing ${name}${alt ? ` (or ${alt})` : ""} in env`);
  return v;
}

/**
 * fetch with bounded retry: transient network failures ("fetch failed", timeouts) and
 * retryable HTTP statuses (429/5xx) get up to 3 further attempts with exponential
 * backoff. A multi-minute keyed run must not be lost to one blip mid-batch.
 */
async function fetchWithRetry(url: string, init: RequestInit, label: string): Promise<Response> {
  const delaysMs = [2000, 8000, 20000];
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, init);
      if ((res.status === 429 || res.status >= 500) && attempt < delaysMs.length) {
        console.warn(`[retry] ${label} HTTP ${res.status}; retrying in ${delaysMs[attempt]}ms`);
        await new Promise((r) => setTimeout(r, delaysMs[attempt]));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt >= delaysMs.length) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[retry] ${label} ${msg}; retrying in ${delaysMs[attempt]}ms`);
      await new Promise((r) => setTimeout(r, delaysMs[attempt]));
    }
  }
}

/** Bind an ExtractionGenerate directly to a provider chat API (temperature 0). */
function makeGenerate(spec: ModelSpec): ExtractionGenerate {
  if (spec.family === "openai" || spec.family === "together") {
    // Together is OpenAI-compatible; only base URL + key env differ.
    const baseUrl =
      spec.family === "together" ? "https://api.together.xyz/v1" : "https://api.openai.com/v1";
    const key =
      spec.family === "together" ? requireEnv("TOGETHER_API_KEY") : requireEnv("OPENAI_API_KEY");
    return async ({ system, user }) => {
      const res = await fetchWithRetry(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: spec.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      }, `${spec.family} ${spec.model}`);
      if (!res.ok)
        throw new Error(`${spec.family} ${spec.model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const d = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return d.choices?.[0]?.message?.content ?? "";
    };
  }
  if (spec.family === "anthropic") {
    const key = requireEnv("ANTHROPIC_API_KEY");
    return async ({ system, user }) => {
      const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: spec.model,
          max_tokens: 4096,
          temperature: 0,
          system,
          messages: [{ role: "user", content: user }],
        }),
      }, `anthropic ${spec.model}`);
      if (!res.ok) throw new Error(`anthropic ${spec.model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const d = (await res.json()) as { content?: { type: string; text?: string }[] };
      return d.content?.find((b) => b.type === "text")?.text ?? "";
    };
  }
  const key = requireEnv("GOOGLE_API_KEY", "GEMINI_API_KEY");
  return async ({ system, user }) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${spec.model}:generateContent?key=${key}`;
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    }, `google ${spec.model}`);
    if (!res.ok) throw new Error(`google ${spec.model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const d = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return d.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  };
}

/** Live-call cost counters, recorded per path so legacy vs EBV is apples-to-apples. */
type GenStats = { calls: number; in_chars: number; out_chars: number };
const newStats = (): GenStats => ({ calls: 0, in_chars: 0, out_chars: 0 });

function withCounter(gen: ExtractionGenerate, stats: GenStats): ExtractionGenerate {
  return async (args) => {
    stats.calls += 1;
    stats.in_chars += args.system.length + args.user.length;
    const out = await gen(args);
    stats.out_chars += out.length;
    return out;
  };
}

const EVIDENCE_RETRIEVAL_SYSTEM =
  `You are an evidence retriever. For each claim, copy the exact sentence(s) from the ` +
  `SOURCE TEXT that support it — character-for-character, no paraphrase, no abbreviation. ` +
  `If nothing in the source supports the claim, return an empty string for it. ` +
  `Return STRICT JSON only:\n` +
  `{ "results": [{ "ref": "<ref>", "quote": "<verbatim quote or empty string>" }] }\n` +
  `Include one result for every listed ref.`;

function parseQuoteResponse(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s < 0 || e <= s) return out;
    try {
      obj = JSON.parse(raw.slice(s, e + 1));
    } catch {
      return out;
    }
  }
  const results = Array.isArray((obj as Record<string, unknown>)?.results)
    ? ((obj as Record<string, unknown>).results as unknown[])
    : [];
  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    if (typeof rec.ref === "string" && rec.ref.trim()) {
      out.set(rec.ref.trim(), typeof rec.quote === "string" ? rec.quote : "");
    }
  }
  return out;
}

/**
 * EBV step 1+Layer 1 (once per extractor — deterministic given the quotes): retrieve a
 * verbatim supporting quote for every fixture claim from its CITED source (mirrors the
 * extraction contract's mandatory evidence field), then bind deterministically.
 * Misattributed claims structurally fail here: their quote cannot bind to the cited source.
 */
async function retrieveAndBindEvidence(args: {
  fixture: EfficacyFixture;
  extractorGen: ExtractionGenerate;
}): Promise<Map<string, EvidenceBinding>> {
  const bindings = new Map<string, EvidenceBinding>();
  for (const src of args.fixture.sources) {
    const claims = args.fixture.claims.filter((c) => c.source_id === src.id);
    if (claims.length === 0) continue;
    const sourceHash = await contentHash(src.text);
    const BATCH = 10;
    for (let off = 0; off < claims.length; off += BATCH) {
      const slice = claims.slice(off, off + BATCH);
      const user =
        `SOURCE TEXT:\n${src.text}\n\nCLAIMS:\n` +
        slice.map((c) => `- ${c.id}: ${c.text}`).join("\n");
      const raw = await args.extractorGen({ system: EVIDENCE_RETRIEVAL_SYSTEM, user });
      const quotes = parseQuoteResponse(raw);
      for (const c of slice) {
        bindings.set(
          c.id,
          bindEvidenceSpan({
            quote: quotes.get(c.id) ?? "",
            sourceText: src.text,
            sourceHash,
          }),
        );
      }
    }
  }
  return bindings;
}

/**
 * Map an entailment outcome onto the harness verdict scale. Strict-recall honesty:
 * a coverage-gap abstention is "omitted" (never a catch); a structural no-bind or a
 * deliberate abstention is an actively-returned flag ("weak"-equivalent).
 */
function ebvToClaimVerdict(r: UnitEntailment): ClaimVerdict {
  if (r.verdict === "entailed") {
    return r.confidence !== null && r.confidence < 0.5 ? "weak" : "ok";
  }
  if (r.verdict === "not_entailed") return "unsupported";
  return r.note?.startsWith("coverage_gap") ? "omitted" : "weak";
}

function hydratePack() {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    workspace_id: "00000000-0000-4000-8000-000000000001",
    is_builtin: false,
    created_at: "2026-06-09T00:00:00.000Z",
    updated_at: "2026-06-09T00:00:00.000Z",
    ...PHILOSOPHY_DOMAIN_PACK,
    prompts: PHILOSOPHY_DOMAIN_PACK.prompts ?? {},
  } as Parameters<typeof collectValidationVerdicts>[0]["pack"];
}

/** Deterministic shuffle so runs are reproducible per (seed, list length). */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type Args = {
  validators: ModelSpec[];
  extractor: ModelSpec;
  runs: number;
  withExtraction: boolean;
  ebv: boolean;
  fixturePath: string;
  out: string;
  maxExtractedUnits: number;
};

function parseArgs(argv: string[]): Args {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const args: Args = {
    validators: [],
    extractor: parseSpec("openai"),
    runs: 3,
    withExtraction: false,
    ebv: false,
    fixturePath: path.join(
      here,
      "../../packages/connect-core/src/ingest/golden/fixtures/verifier-efficacy-v1.json",
    ),
    out: path.join(here, "verifier-efficacy-results.json"),
    maxExtractedUnits: 12,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--validator") args.validators.push(parseSpec(argv[++i]));
    else if (a === "--extractor") args.extractor = parseSpec(argv[++i]);
    else if (a === "--runs") args.runs = Math.max(1, Number(argv[++i]) || 1);
    else if (a === "--with-extraction") args.withExtraction = true;
    else if (a === "--ebv") args.ebv = true;
    else if (a === "--fixture") args.fixturePath = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--max-extracted") args.maxExtractedUnits = Math.max(0, Number(argv[++i]) || 0);
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (args.validators.length === 0) args.validators.push(parseSpec("openai"));
  return args;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixture = JSON.parse(readFileSync(args.fixturePath, "utf8")) as EfficacyFixture;
  const problems = validateEfficacyFixture(fixture);
  if (problems.length > 0) {
    console.error("Fixture invalid:\n" + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(2);
  }
  const pack = hydratePack();
  const sources = new Map(fixture.sources.map((s) => [s.id, s]));

  // Extracted-unit context per source is computed ONCE per extractor (not per run) so the
  // validator comparison across pairings sees identical batch composition.
  const extractedBySource = new Map<string, ValidationInput[]>();
  if (args.withExtraction) {
    const extractorGen = makeGenerate(args.extractor);
    for (const src of fixture.sources) {
      const result = await extractGraph({ text: src.text, pack, generate: extractorGen });
      const units = (result.units ?? [])
        .slice(0, args.maxExtractedUnits)
        .map((u, i) => ({ ref: `x-${src.id}-${i}`, text: u.text }));
      extractedBySource.set(src.id, units);
      console.log(`[extract] ${src.id}: ${units.length} unit(s) via ${args.extractor.family}:${args.extractor.model}`);
    }
  }

  // EBV (Stage 1.0d): quote retrieval + deterministic binding, once per extractor —
  // the bindings are shared across validators/runs (Layer 1 is deterministic).
  let ebvBindings: Map<string, EvidenceBinding> | null = null;
  const ebvRetrievalStats = newStats();
  if (args.ebv) {
    ebvBindings = await retrieveAndBindEvidence({
      fixture,
      extractorGen: withCounter(makeGenerate(args.extractor), ebvRetrievalStats),
    });
    const counts = { bound: 0, unbound: 0, no_evidence: 0 };
    for (const b of ebvBindings.values()) counts[b.status] += 1;
    console.log(
      `[ebv-bind] ${counts.bound} bound, ${counts.unbound} unbound, ${counts.no_evidence} no-quote ` +
        `(retrieval via ${args.extractor.family}:${args.extractor.model}, ${ebvRetrievalStats.calls} call(s))`,
    );
  }

  const pairings: {
    validator: ModelSpec;
    relationship: "cross_model" | "same_model" | "claims_only";
    runs: EfficacyRunResult[];
    legacyCost: GenStats;
    ebvRuns: EfficacyRunResult[];
    ebvCost: GenStats;
  }[] = [];

  for (const validator of args.validators) {
    const relationship = !args.withExtraction && !args.ebv
      ? "claims_only"
      : validator.family === args.extractor.family
        ? "same_model"
        : "cross_model";
    const legacyCost = newStats();
    const ebvCost = newStats();
    const validatorGen = withCounter(makeGenerate(validator), legacyCost);
    const ebvValidatorGen = withCounter(makeGenerate(validator), ebvCost);
    const runs: EfficacyRunResult[] = [];
    const ebvRuns: EfficacyRunResult[] = [];
    for (let run = 0; run < args.runs; run++) {
      const verdictsAll = new Map<string, "ok" | "weak" | "unsupported" | "omitted">();
      for (const src of fixture.sources) {
        const planted: ValidationInput[] = fixture.claims
          .filter((c) => c.source_id === src.id)
          .map((c) => ({ ref: c.id, text: c.text }));
        const context = extractedBySource.get(src.id) ?? [];
        const units = seededShuffle([...planted, ...context], run + 1);
        const verdicts = await collectValidationVerdicts({
          units,
          sourceText: src.text,
          pack,
          generate: validatorGen,
          qualityPreset: "production",
        });
        for (const [ref, v] of verdicts) verdictsAll.set(ref, v);
      }
      const scored = scoreOutcomes(fixture.claims, verdictsAll);
      runs.push(scored);
      console.log(
        `[run ${run + 1}/${args.runs}] ${validator.family}:${validator.model} (${relationship}) ` +
          `bad-recall(strict)=${pct(scored.all_bad.recall_strict)} false-flag=${pct(scored.supported.false_flag_rate)}` +
          (scored.unscored.length ? ` UNSCORED=${scored.unscored.length}` : ""),
      );

      if (args.ebv && ebvBindings) {
        const inputs = fixture.claims.map((c) => {
          const b = ebvBindings!.get(c.id);
          return {
            ref: c.id,
            claim: c.text,
            spans: b?.status === "bound" ? [b.span.quote] : [],
          };
        });
        const { results } = await judgeEntailment({
          inputs,
          generate: ebvValidatorGen,
          modelId: `${validator.family}:${validator.model}`,
        });
        const ebvVerdicts = new Map<string, ClaimVerdict>();
        for (const r of results) ebvVerdicts.set(r.ref, ebvToClaimVerdict(r));
        const ebvScored = scoreOutcomes(fixture.claims, ebvVerdicts);
        ebvRuns.push(ebvScored);
        console.log(
          `[run ${run + 1}/${args.runs}] ${validator.family}:${validator.model} (${relationship}) EBV ` +
            `bad-recall(strict)=${pct(ebvScored.all_bad.recall_strict)} false-flag=${pct(ebvScored.supported.false_flag_rate)}`,
        );
      }
    }
    pairings.push({ validator, relationship, runs, legacyCost, ebvRuns, ebvCost });
  }

  const bindingCounts = (() => {
    if (!ebvBindings) return null;
    const counts = { bound: 0, unbound: 0, no_evidence: 0 };
    for (const b of ebvBindings.values()) counts[b.status] += 1;
    return counts;
  })();

  const report = {
    schema_version: args.ebv ? 2 : 1,
    generated_at: new Date().toISOString(),
    fixture: { path: path.relative(process.cwd(), args.fixturePath), version: fixture.version, claims: fixture.claims.length },
    config: {
      mode: args.withExtraction ? "with-extraction" : "claims-only",
      ebv: args.ebv,
      extractor: args.withExtraction || args.ebv ? `${args.extractor.family}:${args.extractor.model}` : null,
      runs: args.runs,
      validation_batch_size_env: process.env.CONNECT_VALIDATION_BATCH_SIZE ?? null,
    },
    ...(args.ebv
      ? {
          ebv_binding: {
            counts: bindingCounts,
            retrieval_cost: ebvRetrievalStats,
          },
        }
      : {}),
    pairings: pairings.map((p) => ({
      validator: `${p.validator.family}:${p.validator.model}`,
      relationship: p.relationship,
      aggregated: aggregateRuns(p.runs),
      runs: p.runs,
      ...(args.ebv
        ? {
            cost_legacy: p.legacyCost,
            ebv: {
              aggregated: aggregateRuns(p.ebvRuns),
              runs: p.ebvRuns,
              cost: p.ebvCost,
            },
          }
        : {}),
    })),
    cross_model_delta: (() => {
      const cross = pairings.filter((p) => p.relationship === "cross_model");
      const same = pairings.filter((p) => p.relationship === "same_model");
      if (cross.length === 0 || same.length === 0) return null;
      const mean = (list: typeof pairings) =>
        list.reduce((a, p) => a + aggregateRuns(p.runs).all_bad_recall_strict.mean, 0) / list.length;
      return { all_bad_recall_strict_cross_minus_same: mean(cross) - mean(same) };
    })(),
  };

  writeFileSync(args.out, JSON.stringify(report, null, 2));
  console.log(`\n══ Summary (strict recall = caught by a returned verdict; omissions are NOT catches) ══`);
  for (const p of report.pairings) {
    const a = p.aggregated;
    console.log(
      `${p.validator.padEnd(40)} ${p.relationship.padEnd(12)} ` +
        `fabricated=${pct(a.tiers.fabricated.recall_strict.mean)}±${pct(a.tiers.fabricated.recall_strict.stddev)} ` +
        `overstated=${pct(a.tiers.overstated.recall_strict.mean)}±${pct(a.tiers.overstated.recall_strict.stddev)} ` +
        `misattributed=${pct(a.tiers.misattributed.recall_strict.mean)}±${pct(a.tiers.misattributed.recall_strict.stddev)} ` +
        `false-flag=${pct(a.supported_false_flag_rate.mean)}`,
    );
    console.log(
      `${" ".repeat(40)} window-probe  affirm-unseen(FAIL-OPEN)=${pct(a.window_affirm_unseen_rate.mean)}±${pct(a.window_affirm_unseen_rate.stddev)} ` +
        `bad-late-recall=${pct(a.window_bad_late_recall_strict.mean)}±${pct(a.window_bad_late_recall_strict.stddev)}`,
    );
  }
  if (report.cross_model_delta) {
    console.log(
      `cross-model − same-model (all-bad strict recall): ${pct(report.cross_model_delta.all_bad_recall_strict_cross_minus_same)}`,
    );
  }
  if (args.ebv) {
    console.log(`\n══ EBV (Layer 1 bind + span-scoped entailment) — before/after vs legacy ══`);
    if (bindingCounts) {
      console.log(
        `bindings: ${bindingCounts.bound} bound, ${bindingCounts.unbound} unbound, ` +
          `${bindingCounts.no_evidence} no-quote (retrieval: ${ebvRetrievalStats.calls} call(s), ` +
          `${Math.round(ebvRetrievalStats.in_chars / 1000)}k chars in)`,
      );
    }
    for (const p of pairings) {
      const a = aggregateRuns(p.ebvRuns);
      console.log(
        `${`${p.validator.family}:${p.validator.model}`.padEnd(40)} ${p.relationship.padEnd(12)} EBV ` +
          `fabricated=${pct(a.tiers.fabricated.recall_strict.mean)}±${pct(a.tiers.fabricated.recall_strict.stddev)} ` +
          `overstated=${pct(a.tiers.overstated.recall_strict.mean)}±${pct(a.tiers.overstated.recall_strict.stddev)} ` +
          `misattributed=${pct(a.tiers.misattributed.recall_strict.mean)}±${pct(a.tiers.misattributed.recall_strict.stddev)} ` +
          `false-flag=${pct(a.supported_false_flag_rate.mean)}`,
      );
      console.log(
        `${" ".repeat(40)} cost/run: legacy ${Math.round(p.legacyCost.in_chars / args.runs / 1000)}k chars in ` +
          `(${(p.legacyCost.calls / args.runs).toFixed(1)} calls) vs EBV ${Math.round(p.ebvCost.in_chars / args.runs / 1000)}k chars in ` +
          `(${(p.ebvCost.calls / args.runs).toFixed(1)} calls)`,
      );
    }
  }
  console.log(`Report written to ${path.relative(process.cwd(), args.out)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
