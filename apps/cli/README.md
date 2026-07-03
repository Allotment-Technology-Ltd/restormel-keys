# restormel CLI

`restormel` is the developer surface for inspecting a Restormel knowledge graph
from the terminal — outside the dashboard. The first command is `inspect`: a
dry-run retrieval that shows what *would* be retrieved under your trust policy
versus what *exists but is filtered out*, and explains why each candidate was
dropped. (`replay` and `trace` follow in later builds.)

## Install and auth setup

```bash
# 1. Install (when published)
npm install -g @restormel/cli      # or: npx @restormel/cli

# 2. Log in — interactive prompt stores workspace + key in ~/.restormel/config.json
restormel auth login

# 3. Confirm the stored config (the API key is masked)
restormel auth status

# 4. Inspect against the hosted API (uses the stored key)
restormel inspect "what are the main arguments for utilitarianism?"

# 5. Or inspect a local graph store directly, bypassing the API
restormel inspect "..." --graph-store http://localhost:8000/sql
```

Config precedence, lowest to highest: `~/.restormel/config.json` →
`RESTORMEL_*` env vars → command-line flags.

### Global options

| Flag | Description |
| --- | --- |
| `--workspace <id>` | Restormel workspace ID |
| `--api-key <key>` | API key (or `RESTORMEL_API_KEY`) |
| `--graph-store <url>` | Direct graph store URL — local mode, bypasses the API |
| `--output <format>` | `json` or `pretty` (default `pretty`) |
| `--quiet` | Suppress explanatory text; output data only |

### Relevant env vars

- `RESTORMEL_API_KEY` — API key fallback
- `RESTORMEL_WORKSPACE_ID` — workspace fallback
- `RESTORMEL_GRAPH_STORE_URL` — local graph store URL fallback
- `RESTORMEL_GRAPH_STORE_TYPE` — `surrealdb` (default) or `neo4j`
- `RESTORMEL_GRAPH_STORE_CREDS` — JSON, e.g. `{"username":"root","password":"root"}`
- `RESTORMEL_API_BASE` — override the hosted API base (default `https://api.restormel.dev`)

## `restormel inspect`

```
restormel inspect [query] [options]
```

| Option | Default | Description |
| --- | --- | --- |
| `--include-weak` | off | Include weak claims (otherwise supported only) |
| `--include-unsupported` | off | Include unsupported claims |
| `--depth <n>` | 3 | Traversal depth |
| `--max-tokens <n>` | 2000 | Token budget for the assembled context |
| `--min-trust <n>` | — | Minimum trust score (0–100) to admit a claim |
| `--no-show-filtered` | shows filtered | Hide the "filtered out" section |
| `--seed <nodeId>` | — | Start traversal from a specific node |
| `--format <fmt>` | from `--output` | `pretty`, `json` or `markdown` |
| `--watch` | off | Re-run on a timer and print a diff of what changed |
| `--watch-interval <s>` | 60 | Watch poll interval in seconds |

### Modes

- **Local** (`--graph-store <url>` set): imports `@restormel/graphrag-core`
  directly, retrieves permissively, then re-applies your configured policy
  in-process to partition the candidates. No network round-trip to the API.
- **Hosted** (API key set, no `--graph-store`): POSTs to
  `${RESTORMEL_API_BASE}/connect/v1/inspect`. This endpoint is not yet live;
  until it ships the CLI prints: *"API inspect endpoint is not yet available.
  Use --graph-store for direct local inspection."*

## Output formats

### `pretty` (default)

Colourised, legible on a dark terminal:

```
────────────────────────────────────────────────────────
RESTORMEL INSPECT
Query: "what are the main arguments for utilitarianism?"
Workspace: my-workspace · Domain: ethics
────────────────────────────────────────────────────────

WOULD RETRIEVE (12 claims · 2,847 tokens)

✓ SUPPORTED [0.91]  Utilitarianism holds that the right action is the
                     one that maximises overall happiness.
                     Source: stanford-plato/utilitarianism
                     Depth: 1 · Via: seed

~ WEAK      [0.61]  Bentham's felicific calculus can measure pleasure
                     objectively.
                     Source: bentham-introduction-ch4
                     Note: included because --include-weak is set

FILTERED OUT (8 claims)

✗ UNSUPPORTED       Utilitarianism was invented by Plato.
                     Reason: verification_state = unsupported
                     Source: unknown-blog-post

────────────────────────────────────────────────────────
TRAVERSAL SUMMARY
Seeds: 3 · Hops: 3 · Candidates evaluated: 47
Retrieved: 12 · Filtered: 8 · Tokens: 2,847 / 2,000 budget
────────────────────────────────────────────────────────
```

### `json` (`--format json` or `--output json`)

Machine-readable, pipe-friendly. Emits `would_retrieve[]`, `filtered_out[]` and
a `trace_summary` object. No colour codes — safe to pipe into `jq`.

```bash
restormel inspect "..." --graph-store <url> --format json | jq '.would_retrieve[].claim_text'
```

### `markdown` (`--format markdown`)

A markdown document for pasting into a README or issue: retrieved claims as a
table, filtered claims inside a collapsed `<details>` block.

## `--watch` mode

After the initial result, `--watch` re-runs the inspect every
`--watch-interval` seconds (default 60) and prints a diff to stderr: claims
added (`+`), claims whose verification state changed (`~`), and claims removed
(`-`). Useful during an active ingestion session. Press Ctrl+C to stop.

```bash
restormel inspect "..." --graph-store <url> --watch --watch-interval 30
```

## Common failure modes

| Message | Fix |
| --- | --- |
| *No supported claims matched your query…* | The graph lacks relevant content or the trust threshold is too high. Try `--include-weak` or `--depth 5`. |
| *Cannot reach graph store at \<url\>…* | Check your connection and `RESTORMEL_GRAPH_STORE_URL`. |
| *This workspace has no domain pack configured…* | Complete pipeline setup at restormel.dev/dashboard first. |
| *Result truncated: N additional claims available…* | Raise `--max-tokens` to retrieve more. |
| *API inspect endpoint is not yet available…* | Use `--graph-store <url>` for direct local inspection. |

## Exit codes

- `0` — claims retrieved.
- `1` — error (bad input, unreachable store, API failure).
- `2` — ran successfully but retrieved zero claims under the policy.
