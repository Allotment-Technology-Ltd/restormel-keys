# basic-web — runnable Restormel / Testing example

Tiny **static HTML** app plus **`restormel-testing.yaml`** with a **`web-critical`** suite (**two** observe-only browser goals). Use it to verify **config → runner → CLI → report artefacts** locally.

There is **no** Plot dependency and no build step for the app itself.

## What’s in the suite

| Goal | What it proves |
|------|----------------|
| `home-shell` | **Home:** `/` loads; copy includes `basic-web`, `runner-ready`, port **4173**, “About this demo”; **`main`** + **`nav`**; `main h1` text is **`basic-web`**. |
| `about-shell` | **Secondary route:** `/about.html` loads; **`about-basic-web`** copy; **`main`**; `main h1` matches. |

All criteria are **deterministic** (no `judge_rubric` / `ac_sequence`). Same surface area as a longer multi-goal suite, **fewer navigations** — see [docs/testing/checklists/adopter-appendix-b-parity/v1.md](../../docs/testing/checklists/adopter-appendix-b-parity/v1.md).

Config file name: **`restormel-testing.yaml`** (hyphenated — matches the CLI default).

## Prerequisites

From the **repository root**:

1. Install dependencies: `pnpm install`
2. Build TypeScript packages: `pnpm run build:testing-packages` (or `pnpm run build:packages` if you build the whole monorepo)
3. Install Playwright Chromium once (runner uses `@restormel/testing-browser-playwright`):

   ```bash
   pnpm --filter @restormel/testing-browser-playwright exec playwright install chromium
   ```

## Run locally (two terminals)

**Terminal A — static server** (must listen on **4173** to match `environments.local.base_url`):

```bash
cd examples/testing-basic-web
pnpm install
pnpm start
```

**Terminal B — validate and run goals** (from repo root):

```bash
node packages/testing-cli/dist/bin/testing.js validate --config examples/testing-basic-web/restormel-testing.yaml
node packages/testing-cli/dist/bin/testing.js run --suite web-critical --config examples/testing-basic-web/restormel-testing.yaml
```

Exit code **0** means the suite **passed**. The CLI prints the artefact directory, for example:

`.restormel-testing/runs/run-…` with `run.json`, `report.json`, `summary.md`, `traces.json`, etc.

Re-run a past folder:

```bash
pnpm exec testing report .restormel-testing/runs/<run-folder>
```

## One-shot demo (same shell)

From **`examples/testing-basic-web`** (starts `serve`, waits for **4173**, then **validate** + **run**):

```bash
cd examples/testing-basic-web
pnpm run demo
```

(`pnpm test` is wired to the same script.)

## npm scripts (this package)

| Script | Command |
|--------|---------|
| `pnpm start` | `serve . -l 4173` |
| `pnpm validate` | `testing validate --config restormel-testing.yaml` (run from this dir with CLI on `PATH`) |
| `pnpm run:web-critical` | `testing run --suite web-critical --config restormel-testing.yaml` |
| `pnpm demo` | `node run-example.mjs` |

## CI note

The monorepo workflow serves this folder and runs **`web-critical`** — see [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). For GitHub Actions patterns (artefacts, fork safety), see [`../testing-github-actions/README.md`](../testing-github-actions/README.md).
