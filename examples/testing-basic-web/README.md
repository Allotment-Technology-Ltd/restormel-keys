# basic-web — runnable Restormel / Testing example

Tiny **static HTML** app plus **`restormel-testing.yaml`** with a **`web-critical`** suite (two **browser** goals). Use it to verify **config → runner → CLI → report artefacts** locally.

There is **no** Plot dependency and no build step for the app itself.

## What’s in the suite

| Goal               | What it proves |
|--------------------|----------------|
| `home-welcome`     | **Happy path:** `/` loads; body includes `basic-web` and `runner-ready`. |
| `hero-heading-exact` | **Structured assertion:** `main` is visible and `main h1` text equals `basic-web`. |

Config file name: **`restormel-testing.yaml`** (hyphenated — matches the CLI default).

## Prerequisites

From the **repository root**:

1. Install dependencies: `pnpm install`
2. Build TypeScript packages: `pnpm run build:packages`
3. Install Playwright Chromium once (runner uses `@restormel/testing-browser-playwright`):

   ```bash
   pnpm --filter @restormel/testing-browser-playwright exec playwright install chromium
   ```

## Run locally (two terminals)

**Terminal A — static server** (must listen on **4173** to match `environments.local.base_url`):

```bash
cd examples/basic-web
pnpm install
pnpm start
```

**Terminal B — validate and run goals:**

```bash
cd examples/basic-web
pnpm validate
pnpm run:web-critical
```

Exit code **0** means the suite **passed**. The CLI prints the artefact directory, for example:

`.restormel-testing/runs/run-…` with `run.json`, `report.json`, `summary.md`, `traces.json`, etc.

Re-run a past folder:

```bash
pnpm exec testing report .restormel-testing/runs/<run-folder>
```

## One-shot demo (same shell)

Starts `serve`, waits for **4173**, then runs **validate** + **run** (kills the server when finished):

```bash
cd examples/basic-web
pnpm run demo
```

(`pnpm test` is wired to the same script.)

## npm scripts (this package)

| Script            | Command |
|-------------------|---------|
| `pnpm start`      | `serve . -l 4173` |
| `pnpm validate`   | `testing validate --config restormel-testing.yaml` |
| `pnpm run:web-critical` | `testing run --suite web-critical --config restormel-testing.yaml` |
| `pnpm demo`       | `node run-example.mjs` |

## CI note

For GitHub Actions patterns (artefacts, fork safety), see [`../github-actions/README.md`](../github-actions/README.md). This example expects a **local** server; in CI you would start the static server in a workflow step before `testing run`.
