# Roadmap

Direction for the project. Kept in sync with [STATUS.md](STATUS.md).

**Focus:** Keys (BYOK + provider routing) is the actively-developed control plane. Testing
and Graph packages are available and independently useful, but not part of the primary
integration path documented in the README.

## Now

- Hardening Keys REST + MCP as the primary integration surfaces — see
  [ARCHITECTURE.md](ARCHITECTURE.md) for the current contract.
- Improving self-hosting docs and the Neon reference path — see [NEON.md](NEON.md).
- `@restormel/keys-elements` host-control improvements (visibility into current selection,
  request-scoped routing, richer loading/error/empty states).

## Next

- Expanding the public example set under [examples/](examples/) — including a self-hosted,
  Neon-backed reference (see [NEON.md](NEON.md)).
- Continued deprecation runway for the legacy in-process `@restormel/keys`,
  `@restormel/keys-svelte`, and `@restormel/keys-react` packages (maintenance-only until
  2026-12-01 — migrate to Keys REST + `@restormel/keys-elements`).

## Later / exploratory

- Graph and Connect (retrieval/ingest) packages — available under `packages/graph-*` and
  documented under [docs/](docs/), but not yet part of the primary Keys integration path.

Open an issue if you want to propose or prioritize something — see
[CONTRIBUTING.md](CONTRIBUTING.md).
