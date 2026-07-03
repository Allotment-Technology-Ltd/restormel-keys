# Contributing

Thanks for your interest in Restormel Keys.

## Where development happens

The canonical source of truth for this project is a private instance; this GitHub repository
is maintained as a curated public export of the open-source packages, docs, and examples.
Issues and pull requests opened here are welcome and are triaged by the maintainer.

## Before you open a PR

- Keep changes scoped to a single package or doc where possible — smaller PRs review faster.
- Run the package's own tests and lint/typecheck before opening (`pnpm --filter <package> test`).
- If you're touching credential handling, auth, or anything security-sensitive, read
  [SECURITY.md](SECURITY.md) first and call it out explicitly in the PR description.
- New public packages, breaking API changes, or anything affecting
  [docs/reference/npm-packages.md](docs/reference/npm-packages.md) should explain the "why"
  in the PR, not just the "what".

## Reporting bugs / requesting features

Open a GitHub issue with a clear repro (for bugs) or a concrete use case (for features). Check
[ROADMAP.md](ROADMAP.md) first — it may already be planned.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind; assume good
faith.

## Release process

Publishing is tag-driven (see [README.md](README.md#publishing) for the exact package → tag
mapping). Maintainers cut releases; you don't need to worry about versioning in a PR unless
asked.
