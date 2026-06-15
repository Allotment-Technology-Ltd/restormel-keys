/**
 * Verifying proxy — local Mode-1 upstream FIXTURE. (planning/w2-1-phase-a-reference-integration.md.)
 *
 * A real `McpServer` exposing one Mode-1 tool, `graph_answer(query)`, over a small BUNDLED
 * public-domain corpus (./corpus/*.md). It returns {answer, claims[], sources:[{id,text,uri?}]}
 * shaped exactly like a GraphRAG-style upstream — with ONE grounded claim (entailed by a returned
 * source span) and ONE planted UNSUPPORTED claim (no entailing span) so the proxy's accept/abstain
 * behaviour is exercised end-to-end.
 *
 * Hermetic: bundled text, no third-party creds, NO egress (R8/SSRF is a remote-only gate). The
 * corpus is read from disk relative to this module (works under tsx and vitest); if that read
 * ever fails, an inline fallback keeps the fixture deterministic.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

export const MODE1_TOOL_NAME = "graph_answer";

/** The (known) author of these answers — used by the proxy for validator-independence (D-c). */
export const FIXTURE_ANSWER_AUTHOR = { family: "fixture-graphrag", model: "fixture-mode1-1" } as const;

const HERE = path.dirname(fileURLToPath(import.meta.url));

function loadCorpus(file: string, fallback: string): string {
  try {
    return readFileSync(path.join(HERE, "corpus", file), "utf8");
  } catch {
    return fallback;
  }
}

const LIGHTHOUSE = loadCorpus(
  "lighthouse.md",
  "The first lighthouse built on the Eddystone Rocks was completed in 1698 by Henry Winstanley.",
);
const HONEYBEE = loadCorpus(
  "honeybee.md",
  "A forager that has found a good source of food returns to the hive and performs a \"waggle dance\".",
);

type CorpusDoc = { id: string; text: string; uri: string };
const CORPUS: CorpusDoc[] = [
  { id: "lighthouse", text: LIGHTHOUSE, uri: "corpus://lighthouse.md" },
  { id: "honeybee", text: HONEYBEE, uri: "corpus://honeybee.md" },
];

/**
 * A canned Mode-1 answer per query topic. Each carries:
 *   - a GROUNDED claim whose support is a verbatim span in the cited source, AND
 *   - a PLANTED UNSUPPORTED claim that contradicts/overstates the source (no entailing span).
 */
type Mode1Answer = {
  answer: string;
  claims: string[];
  sourceIds: string[];
  /** Documented for the test/runner: which claim is grounded vs planted. */
  grounded: string;
  planted: string;
};

const LIGHTHOUSE_GROUNDED =
  "The first lighthouse on the Eddystone Rocks was completed in 1698 by Henry Winstanley.";
const LIGHTHOUSE_PLANTED =
  "Henry Winstanley's lighthouse still stands on the Eddystone Rocks today.";

const BEE_GROUNDED =
  "A forager honey bee that finds food returns to the hive and performs a waggle dance to communicate its direction and distance.";
const BEE_PLANTED = "Drone honey bees gather most of the colony's nectar and pollen.";

const ANSWERS: { match: (q: string) => boolean; answer: Mode1Answer }[] = [
  {
    match: (q) => /lighthouse|eddystone|winstanley|smeaton/i.test(q),
    answer: {
      answer: `${LIGHTHOUSE_GROUNDED} ${LIGHTHOUSE_PLANTED}`,
      claims: [LIGHTHOUSE_GROUNDED, LIGHTHOUSE_PLANTED],
      sourceIds: ["lighthouse"],
      grounded: LIGHTHOUSE_GROUNDED,
      planted: LIGHTHOUSE_PLANTED,
    },
  },
  {
    match: (q) => /bee|honey|hive|waggle|forager|drone/i.test(q),
    answer: {
      answer: `${BEE_GROUNDED} ${BEE_PLANTED}`,
      claims: [BEE_GROUNDED, BEE_PLANTED],
      sourceIds: ["honeybee"],
      grounded: BEE_GROUNDED,
      planted: BEE_PLANTED,
    },
  },
];

/** Exposed so tests/runner can assert against the planted/grounded claims by name. */
export const FIXTURE_EXPECTATIONS = {
  lighthouse: { grounded: LIGHTHOUSE_GROUNDED, planted: LIGHTHOUSE_PLANTED },
  honeybee: { grounded: BEE_GROUNDED, planted: BEE_PLANTED },
} as const;

/** Resolve a query to its Mode-1 answer (defaults to the lighthouse topic). */
export function answerFor(query: string): {
  answer: string;
  claims: string[];
  sources: CorpusDoc[];
} {
  const hit = ANSWERS.find((a) => a.match(query)) ?? ANSWERS[0]!;
  const sources = CORPUS.filter((c) => hit.answer.sourceIds.includes(c.id));
  return { answer: hit.answer.answer, claims: hit.answer.claims, sources };
}

/**
 * Build the Mode-1 upstream MCP server (transport NOT connected). Link it to a Client via the
 * SDK's in-memory transport in tests, or run it over stdio via runMode1UpstreamStdio().
 */
export function createMode1UpstreamServer(): McpServer {
  const server = new McpServer({ name: "fixture-mode1-upstream", version: "0.1.0" });

  server.registerTool(
    MODE1_TOOL_NAME,
    {
      description:
        "Mode-1 GraphRAG-style answer over a small bundled public-domain corpus. Returns " +
        "{answer, claims[], sources:[{id,text,uri}]}. One claim is grounded; one is planted-unsupported.",
      inputSchema: { query: z.string().min(1).describe("Natural-language question over the corpus.") },
    },
    async (args: { query: string }) => {
      const { answer, claims, sources } = answerFor(args.query);
      const payload = {
        answer,
        claims,
        sources: sources.map((s) => ({ id: s.id, text: s.text, uri: s.uri })),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
    },
  );

  return server;
}

/** Run the fixture over stdio (for the stdio-transport fallback path / manual exercise). */
export async function runMode1UpstreamStdio(): Promise<void> {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const server = createMode1UpstreamServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[fixture-mode1-upstream] stdio transport connected.");
}

// Allow `tsx fixtures/mode1-upstream.ts` to launch the stdio upstream directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMode1UpstreamStdio().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
