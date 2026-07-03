/**
 * Verifying proxy — reference runner (W2-1). (planning/w2-1-phase-a-reference-integration.md)
 *
 * Runs the proxy verify core end-to-end and prints:
 *   - VerifiedEnvelope per query (claim → status + binding + entailment + source_ref)
 *   - per-leg latency: callTool / quote-retrieval / judgeEntailment / layer-1  (p50/p95)
 *   - Restormel-side validator cost {calls, chars}
 *
 * UPSTREAM MODES
 * ──────────────
 * (default)            in-memory linked transport to the bundled fixture — no subprocess, no
 *                      egress. Always reproducible; exercises the full verify core.
 *
 * --upstream http://…  StreamableHTTP remote upstream (connectUpstreamHttp + SSRF guard).
 *                      Start the local reference server first:
 *                        pnpm exec tsx packages/mcp/src/proxy/fixtures/mode1-http-server.ts
 *                      Then run this script with --upstream http://localhost:3741/mcp
 *
 * --upstream stdio:<cmd> [args…]
 *                      Spawn a subprocess upstream over stdio (connectUpstreamStdio). The
 *                      bundled fixture supports this too:
 *                        --upstream stdio:tsx packages/mcp/src/proxy/fixtures/mode1-upstream.ts
 *
 * VALIDATOR
 * ─────────
 * (default)            STUB — deterministic, no keys, fully reproducible.
 *
 * --validator <family:model>
 *                      Real provider LLM (D-c: must differ from fixture answer-author family
 *                      "fixture-graphrag"). Key read from env:
 *                        openai:<model>       → OPENAI_API_KEY
 *                        together:<model>     → TOGETHER_API_KEY
 *                        anthropic:<model>    → ANTHROPIC_API_KEY
 *                        google:<model>       → GOOGLE_API_KEY / GEMINI_API_KEY
 *
 * REPRODUCIBLE REAL-CAPTURE COMMAND (for the operator, after setting keys):
 *   # 1. Start the reference upstream in one terminal:
 *   #      pnpm exec tsx packages/mcp/src/proxy/fixtures/mode1-http-server.ts
 *   # 2. In a second terminal run the capture:
 *   #      OPENAI_API_KEY=sk-… pnpm exec tsx scripts/reviews/verifying-proxy-reference.ts \
 *   #        --upstream http://localhost:3741/mcp \
 *   #        --validator openai:gpt-4o-mini
 *   #    or with Together AI (independent family — Llama ≠ fixture-graphrag):
 *   #      TOGETHER_API_KEY=… pnpm exec tsx scripts/reviews/verifying-proxy-reference.ts \
 *   #        --upstream http://localhost:3741/mcp \
 *   #        --validator together:meta-llama/Llama-3.3-70B-Instruct-Turbo
 *
 * EXPECTED ENVELOPES (stub or real-LLM, fixture upstream):
 *   Query 1 (Eddystone lighthouse):
 *     claim "The first lighthouse on the Eddystone Rocks was completed in 1698 by Henry Winstanley."
 *       → SUPPORTED   (grounded: verbatim span in corpus://lighthouse.md, entailed)
 *     claim "Henry Winstanley's lighthouse still stands on the Eddystone Rocks today."
 *       → UNVERIFIED or ABSTAIN  (planted: no entailing span, not_entailed)
 *   Query 2 (honey bee waggle dance):
 *     claim "A forager honey bee that finds food returns to the hive and performs a waggle dance…"
 *       → SUPPORTED   (grounded)
 *     claim "Drone honey bees gather most of the colony's nectar and pollen."
 *       → UNVERIFIED or ABSTAIN  (planted)
 *
 * This is a MEASUREMENT AID. Exit 0 unless the harness itself fails; latency targets in
 * REC-PLAN-007 are placeholders to be ratified against the first real measurement, not asserted.
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
  connectUpstreamHttp,
  connectUpstreamStdio,
  callMode1Tool,
  type UpstreamConnection,
} from "../../packages/mcp/src/proxy/client.js";
import {
  createMode1UpstreamServer,
  answerFor,
  MODE1_TOOL_NAME,
  FIXTURE_ANSWER_AUTHOR,
  FIXTURE_EXPECTATIONS,
} from "../../packages/mcp/src/proxy/fixtures/mode1-upstream.js";

// ── Upstream mode ────────────────────────────────────────────────────────────

type UpstreamMode =
  | { kind: "memory" }
  | { kind: "http"; url: string }
  | { kind: "stdio"; command: string; args: string[] };

// ── Validator spec ───────────────────────────────────────────────────────────

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

/** Bind an ExtractionGenerate to a provider chat API (temperature 0) — mirrors verifier-efficacy.ts. */
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
 * The default STUB validator: serves pre-baked verbatim quotes + verdicts for the fixture's
 * grounded claims (entailed) and planted claims (not_entailed). Fully reproducible — no keys.
 * Family "restormel-stub" is independent of the fixture answer author ("fixture-graphrag").
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

// ── Connection factory ────────────────────────────────────────────────────────

/**
 * Open a connection to the upstream according to the mode. For the in-memory mode we also return
 * a cleanup handle for the McpServer we spin up internally (it must be closed in the finally).
 */
async function openUpstream(mode: UpstreamMode): Promise<{
  conn: UpstreamConnection;
  closeServer?: () => Promise<void>;
}> {
  if (mode.kind === "http") {
    console.log(`Upstream: HTTP  ${mode.url}  (connectUpstreamHttp + SSRF guard)`);
    const conn = await connectUpstreamHttp(mode.url);
    return { conn };
  }

  if (mode.kind === "stdio") {
    const cmd = [mode.command, ...mode.args].join(" ");
    console.log(`Upstream: stdio  ${cmd}`);
    const conn = await connectUpstreamStdio({ command: mode.command, args: mode.args });
    return { conn };
  }

  // Default: in-memory linked transport (no subprocess, no egress).
  console.log(`Upstream: in-memory fixture (no egress). Pass --upstream <url|stdio:cmd> for a real server.`);
  const server = createMode1UpstreamServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const conn = await connectUpstreamTransport(clientTransport);
  return {
    conn,
    closeServer: async () => server.close().catch(() => {}),
  };
}

// ── Reporting ─────────────────────────────────────────────────────────────────

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

// ── Argument parsing ──────────────────────────────────────────────────────────

type Args = {
  upstream: UpstreamMode;
  validator: ModelSpec | null;
  kSamples: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { upstream: { kind: "memory" }, validator: null, kSamples: 1 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--validator") {
      args.validator = parseSpec(argv[++i]!);
    } else if (a === "--k") {
      args.kSamples = Math.max(1, Number(argv[++i]) || 1);
    } else if (a === "--upstream") {
      const raw = argv[++i]!;
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        args.upstream = { kind: "http", url: raw };
      } else if (raw.startsWith("stdio:")) {
        // --upstream stdio:<command> [args...]  — remaining argv are the command args
        const cmd = raw.slice("stdio:".length);
        if (!cmd) throw new Error("--upstream stdio: requires a command (e.g. stdio:tsx path/to/server.ts)");
        // Consume any remaining non-flag tokens as command args.
        const cmdArgs: string[] = [];
        while (i + 1 < argv.length && !argv[i + 1]!.startsWith("--")) {
          cmdArgs.push(argv[++i]!);
        }
        args.upstream = { kind: "stdio", command: cmd, args: cmdArgs };
      } else {
        throw new Error(
          `--upstream value "${raw}" must start with http://, https://, or stdio:<cmd>`,
        );
      }
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }
  return args;
}

// ── Main ──────────────────────────────────────────────────────────────────────

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
    // D-c: fixture answer-author is "fixture-graphrag" — the validator must differ.
    if (validator.family === FIXTURE_ANSWER_AUTHOR.family) {
      throw new Error(
        `validator family "${validator.family}" must differ from the fixture answer author ` +
          `"${FIXTURE_ANSWER_AUTHOR.family}" (D-c independence)`,
      );
    }
    console.log(`Validator: REAL ${validator.model} (Restormel-selected, independent of fixture author)`);
  } else {
    validator = buildStubValidator();
    console.log(`Validator: STUB (deterministic, no keys). Pass --validator <family:model> for the real leg.`);
  }

  const { conn, closeServer } = await openUpstream(args.upstream);

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
    await closeServer?.();
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

  // Keep the import live for ad-hoc inspection in a REPL.
  void answerFor;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
