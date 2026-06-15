/**
 * Verifying proxy — Phase A reference runner. (planning/w2-1-phase-a-reference-integration.md, W2-1.)
 *
 * Spins up the local Mode-1 upstream FIXTURE, connects the proxy MCP client over the SDK's
 * in-memory linked transport (deterministic; no subprocess, no egress — R8/SSRF is remote-only),
 * runs queries through the verify core, and prints:
 *   - the VerifiedEnvelope per query (claim → status + binding + entailment + source_ref),
 *   - per-leg latency (callTool / quote-retrieval / judgeEntailment / layer-1) with p50/p95, and
 *   - Restormel-side validator cost {calls, chars}.
 *
 * Validator: a STUB by default (no keys, fully reproducible). `--validator <family:model>`
 * exercises the REAL leg against a provider chat API (mirrors verifier-efficacy.ts), bound as a
 * Restormel-selected validator and asserted independent of the fixture answer author (D-c).
 *
 * Usage:
 *   pnpm exec tsx scripts/reviews/verifying-proxy-reference.ts
 *   pnpm exec tsx scripts/reviews/verifying-proxy-reference.ts --validator anthropic:claude-haiku-4-5-20251001
 *
 * This is a MEASUREMENT AID. Exit 0 unless the harness itself fails; latency targets in
 * REC-PLAN-007 are placeholders to be RATIFIED against the first real measurement, not asserted.
 */
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ExtractionGenerate } from "../../packages/connect-core/src/ingest/extract.js";
import {
  verifyEnvelope,
  makeStubValidator,
  type RestormelValidator,
  type VerifiedEnvelope,
} from "../../packages/connect-core/src/proxy/index.js";
import {
  connectUpstreamTransport,
  callMode1Tool,
} from "../../packages/mcp/src/proxy/client.js";
import {
  createMode1UpstreamServer,
  answerFor,
  MODE1_TOOL_NAME,
  FIXTURE_ANSWER_AUTHOR,
  FIXTURE_EXPECTATIONS,
} from "../../packages/mcp/src/proxy/fixtures/mode1-upstream.js";

type ModelSpec = { family: "openai" | "anthropic" | "google" | "together"; model: string };

const DEFAULT_MODELS: Record<ModelSpec["family"], string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  google: "gemini-2.0-flash",
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

/** Bind an ExtractionGenerate to a provider chat API (temperature 0) — same shape as verifier-efficacy.ts. */
function makeProviderGenerate(spec: ModelSpec): ExtractionGenerate {
  if (spec.family === "openai" || spec.family === "together") {
    const baseUrl = spec.family === "together" ? "https://api.together.xyz/v1" : "https://api.openai.com/v1";
    const key = spec.family === "together" ? requireEnv("TOGETHER_API_KEY") : requireEnv("OPENAI_API_KEY");
    return async ({ system, user }) => {
      const res = await fetch(`${baseUrl}/chat/completions`, {
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
      });
      if (!res.ok) throw new Error(`${spec.family} ${spec.model} HTTP ${res.status}`);
      const d = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return d.choices?.[0]?.message?.content ?? "";
    };
  }
  if (spec.family === "anthropic") {
    const key = requireEnv("ANTHROPIC_API_KEY");
    return async ({ system, user }) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: spec.model,
          max_tokens: 4096,
          temperature: 0,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${spec.model} HTTP ${res.status}`);
      const d = (await res.json()) as { content?: { type: string; text?: string }[] };
      return d.content?.find((b) => b.type === "text")?.text ?? "";
    };
  }
  const key = requireEnv("GOOGLE_API_KEY", "GEMINI_API_KEY");
  return async ({ system, user }) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${spec.model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) throw new Error(`google ${spec.model} HTTP ${res.status}`);
    const d = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return d.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  };
}

/**
 * The default STUB validator: serves verbatim quotes + verdicts for the fixture's grounded claims
 * and not_entailed for the planted ones, so the runner is fully reproducible with no keys. It is
 * Restormel-selected (family "restormel-stub") and independent of the fixture author family.
 */
function buildStubValidator(): RestormelValidator {
  const e = FIXTURE_EXPECTATIONS;
  return makeStubValidator({
    fixtureVerdicts: {
      [e.lighthouse.grounded]: { verdict: "entailed", confidence: 0.95 },
      [e.lighthouse.planted]: { verdict: "not_entailed", confidence: 0.9, note: "no entailing span" },
      [e.honeybee.grounded]: { verdict: "entailed", confidence: 0.95 },
      [e.honeybee.planted]: { verdict: "not_entailed", confidence: 0.9, note: "no entailing span" },
    },
    fixtureQuotes: {
      [e.lighthouse.grounded]: [
        "The first lighthouse built on the Eddystone Rocks was completed in 1698 by Henry Winstanley",
      ],
      [e.honeybee.grounded]: [
        "A forager that has found a good source of food\nreturns to the hive and performs a \"waggle dance\" that communicates the direction and distance of\nthe food to other workers",
      ],
      // Planted claims intentionally have NO quote → unbound → never supported.
    },
  });
}

const QUERIES = [
  "Who built the first Eddystone lighthouse and when?",
  "How does a honey bee forager communicate where food is?",
];

function pctl(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

function printEnvelope(query: string, env: VerifiedEnvelope, callToolMs: number): void {
  console.log(`\n── Query: ${query}`);
  console.log(
    `   legs_ms: callTool=${callToolMs} quote_retrieval=${env.meta.legs_ms.quote_retrieval} ` +
      `judge_entailment=${env.meta.legs_ms.judge_entailment} layer1_bind=${env.meta.legs_ms.layer1_bind}`,
  );
  console.log(
    `   validator=${env.meta.validator_model ?? "(none)"} ` +
      `restormel_cost={calls:${env.meta.restormel_cost.calls}, chars:${env.meta.restormel_cost.chars}}`,
  );
  for (const c of env.claims) {
    const bind =
      c.binding.status === "bound"
        ? `bound(${c.binding.span.match}) hash=${c.source_ref.source_hash.slice(0, 12)}…`
        : c.binding.status;
    console.log(
      `   [${c.status.toUpperCase().padEnd(10)}] ${c.entailment.verdict.padEnd(12)} ${bind}\n` +
        `      claim: ${c.claim}`,
    );
  }
}

type Args = { validator: ModelSpec | null; kSamples: number };

function parseArgs(argv: string[]): Args {
  const args: Args = { validator: null, kSamples: 1 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--validator") args.validator = parseSpec(argv[++i]!);
    else if (a === "--k") args.kSamples = Math.max(1, Number(argv[++i]) || 1);
    else throw new Error(`Unknown arg: ${a}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Build the validator: stub by default; real provider leg behind --validator (D-c independent).
  let validator: RestormelValidator;
  if (args.validator) {
    validator = {
      family: args.validator.family,
      model: `${args.validator.family}:${args.validator.model}`,
      generate: makeProviderGenerate(args.validator),
    };
    if (validator.family === FIXTURE_ANSWER_AUTHOR.family) {
      throw new Error(
        `validator family "${validator.family}" must differ from the fixture answer author ` +
          `"${FIXTURE_ANSWER_AUTHOR.family}" (D-c)`,
      );
    }
    console.log(`Validator: REAL ${validator.model} (Restormel-selected, independent of fixture author)`);
  } else {
    validator = buildStubValidator();
    console.log(`Validator: STUB (deterministic, no keys). Pass --validator <family:model> for the real leg.`);
  }

  // Link the proxy client to the fixture upstream over the in-memory transport (no subprocess).
  const server = createMode1UpstreamServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const conn = await connectUpstreamTransport(clientTransport);

  const legSamples: Record<string, number[]> = {
    callTool: [],
    quote_retrieval: [],
    judge_entailment: [],
    layer1_bind: [],
  };
  let supported = 0;
  let reviewed = 0;

  try {
    for (const query of QUERIES) {
      const t0 = performance.now();
      const result = await callMode1Tool({ client: conn.client, name: MODE1_TOOL_NAME, args: { query } });
      const callToolMs = Math.round(performance.now() - t0);

      const env = await verifyEnvelope({
        result,
        validator,
        author: FIXTURE_ANSWER_AUTHOR,
        kSamples: args.kSamples,
      });

      printEnvelope(query, env, callToolMs);
      legSamples.callTool.push(callToolMs);
      legSamples.quote_retrieval.push(env.meta.legs_ms.quote_retrieval);
      legSamples.judge_entailment.push(env.meta.legs_ms.judge_entailment);
      legSamples.layer1_bind.push(env.meta.legs_ms.layer1_bind);
      for (const c of env.claims) {
        if (c.status === "supported") supported += 1;
        else reviewed += 1;
      }
    }
  } finally {
    await conn.close();
    await server.close().catch(() => {});
  }

  console.log(`\n══ Per-leg latency (ms) over ${QUERIES.length} queries ══`);
  for (const [leg, samples] of Object.entries(legSamples)) {
    console.log(`   ${leg.padEnd(16)} p50=${pctl(samples, 50)} p95=${pctl(samples, 95)} max=${Math.max(0, ...samples)}`);
  }
  console.log(`\n══ Outcomes ══`);
  console.log(`   supported=${supported}  routed-to-review=${reviewed}`);
  console.log(
    `   (expected: each query has one grounded → supported and one planted → review; ` +
      `${QUERIES.length} supported / ${QUERIES.length} review with the stub.)`,
  );

  // Sanity: with the stub the grounded claims MUST be supported and planted MUST NOT be.
  if (!args.validator) {
    const expectedSupported = QUERIES.length;
    if (supported !== expectedSupported) {
      console.warn(
        `[warn] stub run produced ${supported} supported, expected ${expectedSupported} — ` +
          `check fixture quotes / verdicts.`,
      );
    }
  }
  // Touch answerFor so the import is meaningful for ad-hoc inspection.
  void answerFor;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
