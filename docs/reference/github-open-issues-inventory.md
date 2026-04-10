# Open GitHub issues — inventory (reference)

**Canonical execution backlog:** [GitHub #90](https://github.com/Allotment-Technology-Ltd/restormel-keys/issues/90). This file maps programme issues to code areas and **repo disposition** (GitHub issues are closed manually after merge with `Fixes #n` / comments).

| Issue | Meta § | Primary paths / notes | Disposition (repo) |
| ----- | ------ | --------------------- | ------------------ |
| #90 | — | Meta checklist | Humans: tick sections in GitHub as children close |
| #91 | A | [`apps/dashboard/src/routes/+page.svelte`](../../apps/dashboard/src/routes/+page.svelte) | Inline SVG suite flow + tokens |
| #92 | A | Homepage testimonial in `+page.svelte` | Neutral quote + programme attribution |
| #93 | A | [`LandingPage.svelte`](../../apps/dashboard/src/lib/testing/components/site/LandingPage.svelte) | Docs/walkthrough CTAs replace demo slab |
| #94 | A | Homepage `+page.svelte` | Roadmap + changelog links in hero |
| #95 | B | [`founders/+page.server.ts`](../../apps/dashboard/src/routes/founders/+page.server.ts) | `FOUNDERS_CIRCLE_SLOTS_TOTAL`, `FOUNDERS_SLOTS_REMAINING_DISPLAY`, count from DB |
| #96 | B | Migration `030_founders_applications.sql`, founders action | Persist JSON when `DATABASE_URL` set |
| #97 | B | Founders webhook | Retries, `Idempotency-Key`, no PII in logs |
| #98–#100 | C | `keys/pricing`, `/pricing`, [`suite-pricing-display.ts`](../../apps/dashboard/src/lib/suite-pricing-display.ts) | Shared fallbacks; Team/Platform checkout when Paddle env set |
| #101–#102 | D | `analytics/+page.server.ts` | `RESTORMEL_ANALYTICS_USE_MOCK_FALLBACK=false` drops chart mocks |
| #103 | D | Analytics aggregates + integration usage | Provider mix from logs; integration page lists usage model IDs |
| #104 | D | `analytics/+page.server.ts`, `+page.svelte` | `?projectId=` filter + chart queries scoped |
| #105 | D | `analytics/+page.svelte` | Spend footnote only when no cost signals |
| #106 | E | `integrations/[id]/+page.server.ts` | `usageModelIds` from `listUsageAggregates` |
| #107 | E | [`integration-verify.ts`](../../apps/dashboard/src/lib/server/integration-verify.ts), verify `+server.ts` | Provider registry + user-visible detail |
| #108 | E | [`lifecycle/+page.svelte`](../../apps/dashboard/src/routes/keys/dashboard/lifecycle/+page.svelte) | Tightened accuracy note |
| #109 | F | [`telemetry.ts`](../../packages/testing-cli/src/telemetry.ts), testing telemetry doc | `RESTORMEL_TELEMETRY_URL`; collector deploy is env ops |
| #110 | G | `changelog/*`, `github-releases.ts` | Error kinds + empty states (prior work) |
| #111 | H | Horizon programme | **2026-04-10:** Children [#122](https://github.com/Allotment-Technology-Ltd/restormel-keys/issues/122), [#123](https://github.com/Allotment-Technology-Ltd/restormel-keys/issues/123), [#124](https://github.com/Allotment-Technology-Ltd/restormel-keys/issues/124) + comment on #111 — maintainer: tick #111 acceptance box / close when satisfied |
| #69 | Dogfood | [`packages/mcp`](../../packages/mcp) | `restormel-mcp --check` / `tools --json` |
| #70 | Dogfood | [`packages/aaif`](../../packages/aaif) | `embedding` + `outputText` on `AAIFResponse` |
| #86 | Dogfood | [`packages/state/README.md`](../../packages/state/README.md) | Install verify, peers, ESM, host persistence |

**Security:** No secrets in issues or this doc; founders payload may contain PII — [`docs/security-baseline.md`](../security-baseline.md).

**Meta (#90 / #111):** After merge, use GitHub to check off #90 and create/link Horizon children for #111; this file does not close remote issues.
