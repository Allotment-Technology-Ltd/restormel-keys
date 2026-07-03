# Restormel Keys × Neon

This page exists for two audiences: developers self-hosting Restormel Keys who want a
database recommendation, and anyone evaluating this project's fit with Postgres/Neon.

## Is Restormel Keys open source and self-hostable?

Yes — MIT licensed (see [LICENSE](LICENSE)). The client packages
(`@restormel/keys-cli`, `@restormel/keys-elements`, `@restormel/mcp`, `@restormel/aaif`,
`@restormel/doctor`, `@restormel/validate`) are published to npm and usable standalone against
Keys REST. Self-hosting the control plane behind Keys REST is documented below.

## Does it run on Postgres?

The client library itself is intentionally database-agnostic — it's a routing/BYOK client,
not a data layer, so it drops into any stack without imposing a storage choice. Where a
database *is* required:

- **Self-hosting the control plane** — durable workspaces, projects, Gateway key metadata,
  integrations metadata. Postgres is required; **Neon is the documented default.**
  Full guide: [docs/guides/database-neon-for-self-hosters.md](docs/guides/database-neon-for-self-hosters.md).
- **`@restormel/testing-runs-server`** (OSS, published) — optional durable job history for
  the Testing runner. In-memory by default; Postgres (Neon in practice) when you configure a
  runs database URL.

## How Restormel uses Neon today

- **Recommended default** for self-hosted deployments, with a full setup guide: project
  creation, branch strategy (`production` + child/preview branches), pooled connection
  strings, and **Neon Auth** for GitHub sign-in.
- **CI preview branches**: each pull request gets an isolated Neon branch — the workflow
  verifies connectivity and applies the Runs schema against it, then deletes the branch when
  the PR closes. It skips automatically when Neon secrets aren't configured (e.g. on forks). See
  [`.github/workflows/neon-preview.yml`](.github/workflows/neon-preview.yml).
- **Runnable example**: [`examples/neon-testing-runs-quickstart`](examples/neon-testing-runs-quickstart)
  starts `@restormel/testing-runs-server` against a Neon branch and shows the Neon-backed store
  answering `/health` (`store: neon`) and `/v1/runs`.

## Why Neon specifically

Restormel's primary integration surface for programmatic and agentic use is MCP
(`@restormel/mcp`) and a typed agent contract (AAIF) — routing/credential infrastructure built
for coding agents and autonomous tool-calling workflows. Ephemeral, cheaply-branched Postgres
per agent run or per PR is a better fit for that world than a single long-lived database
instance, which is why Neon's branching model is what we point people to rather than a
generic "any Postgres works" answer.

## Get started self-hosting with Neon

1. Read [docs/guides/database-neon-for-self-hosters.md](docs/guides/database-neon-for-self-hosters.md)
   for the full setup (Neon project, branches, connection strings, Neon Auth).
2. Try [`examples/neon-testing-runs-quickstart`](examples/neon-testing-runs-quickstart) for a
   working, minimal Neon integration you can run locally in a few minutes.
3. Questions or issues specific to the Neon path — open a GitHub issue and tag it `neon`.
