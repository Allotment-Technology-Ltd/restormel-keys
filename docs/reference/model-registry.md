# Model registry (advisory)

**Status:** Canonical (for this repo)\n
**Purpose:** Define what the local model registry is, how it is maintained, and what it does (and does not) guarantee.

## What it is

The repo contains a lightweight, human-reviewable registry at `registry/models.json`.

It exists to support:

- `restormel-doctor --repo` lifecycle checks (detect models in your codebase and warn about risk)\n
- documentation and examples that need stable model identifiers\n
- a predictable baseline when live APIs are unavailable (offline, rate-limited, CI without secrets)

## What it guarantees

- **Reviewable diffs:** Changes are file-based and can be code-reviewed.\n
- **Stable shape:** The file has a stable schema enforced by `scripts/validate-registry.mjs`.\n
- **Clear intent:** Lifecycle states are explicit (`active`, `deprecated`, `sunset`, `removed`).\n
- **Freshness signal:** `lastUpdatedAt` indicates when the registry was last refreshed.

## What it does NOT guarantee

- **Real-time accuracy.** Providers can change model availability faster than our refresh cadence.\n
- **Complete coverage.** We may not include every provider model, every alias, or every third-party gateway variant.\n
- **Availability for your account.** A model may exist in a registry or gateway catalog but still be unavailable to a given customer.

## How it is maintained

- **Cadence:** Weekly is the default target cadence.\n
- **Mechanism:** A scheduled GitHub Actions workflow (`.github/workflows/registry-refresh.yml`) can refresh registry metadata when live-source secrets are configured.\n
- **Human gate:** Changes should be reviewed and merged like normal code changes.

## How to use it safely

- Treat lifecycle results as **advisory** unless you also run live validation.\n
- In CI, prefer:\n
  - `restormel-validate` to confirm credentials are working now\n
  - `restormel-doctor --repo` to catch drift risks early\n
- If your deployment gates require real-time certainty, add provider-specific live checks (where supported) and fail closed on confirmed invalid credentials.

