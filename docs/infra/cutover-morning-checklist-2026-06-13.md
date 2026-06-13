# Morning operator checklist — 2026-06-13 (post-cutover-night)

Status when written: see the bottom-of-file "overnight outcome" section, updated as the
night progressed. Everything here is OWNER work — agent work is done or blocked on these.

## Must-do (in order, ~15 minutes total)

1. **Browser smoke on staging** (2 min) — B5 items that need a human browser:
   - Open https://staging.restormel.dev/keys/dashboard → expect redirect to `/home`, UI renders.
   - Sign in (GitHub via Neon Auth). Confirm the dashboard home loads signed-in.
   - Note: staging shares the vercel-dev Neon branch — your dev data appears here.

2. **Browser smoke on production** (3 min):
   - Open https://restormel.dev/keys/dashboard → sign in → home loads.
   - Check the padlock: cert should be Let's Encrypt for restormel.dev.
   - **Re-enter provider credentials**: the prod `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY` was
     rotated (old value unrecoverable from Vercel). 5 stored secrets are undecryptable and
     need re-entry: 4 provider integrations + 1 knowledge graph target (Settings → Connections).

3. **Ingest round-trip test** (3 min) — B5 items 5–8:
   - Create a small ingest job from the dashboard UI (staging or prod).
   - Watch Coolify → restormel-worker-{staging|prod} → Logs: the worker should claim and
     process it within ~5s (sweep interval).
   - Confirm the dashboard container logs show NO drain activity for that job.

4. **Seed `COOLIFY_TOKEN` secret in Forgejo** (1 min) — unblocks push-to-deploy CI:
   - https://git.allotmentology.tech → `Allotment-Technology-Ltd/restormel-keys` →
     Settings → Actions → Secrets → New Secret.
   - Name: `COOLIFY_TOKEN`. Value: the Coolify API token you pasted last night
     (Coolify → Keys & Tokens if you need a fresh one — read+write+deploy).
   - Then push any commit to main (or re-run the "Deploy dashboard" workflow) and watch it
     build → trigger serial Coolify deploys with no human step.

5. **If the Forgejo "Deploy dashboard" build job still fails with a docker error** (2 min):
   - On the box: `ssh deploy@77.42.125.150`, then append to `/opt/forgejo-runner/config.yaml`:
     ```yaml
     container:
       docker_host: "automount"
     ```
   - `docker restart forgejo-runner`.
   - (The agent was permission-blocked from editing shared runner config overnight.)

## Should-do this week

6. **Uptime monitoring (E2)**: UptimeRobot (or similar) HTTP monitor on
   `https://restormel.dev/keys/v1/catalog`, 5-min interval, 3-failure alert → your email.
   Optional second monitor for staging.
7. **Hetzner snapshot schedule (E3)**: Hetzner console → the box → enable backups/snapshots.
8. **Paddle sandbox webhook for staging** (optional): Paddle sandbox dashboard →
   Notifications → Webhooks → add `https://staging.restormel.dev/keys/dashboard/api/billing/webhook`,
   then put its secret in the staging apps' `PADDLE_WEBHOOK_SECRET` env (Coolify) and restart.
   (Agent was permission-blocked from creating the webhook destination.)
9. **Neon Auth trusted-origins purge**: ~95 stale `restormel-keys-*.vercel.app` preview
   origins accumulated in Neon Auth (project green-sky-53569304). Keep: restormel.dev, www,
   staging, the 3 stable vercel.app aliases. Ask the agent to do this — pre-approve it.
10. **Vercel previews-only (E1)** — after a day or two of clean running: remove
    `restormel.dev` + `www.restormel.dev` from the Vercel project domains. Do NOT delete the
    project (it's the DR target + PR preview service). Before this, decide www handling:
    add `https://www.restormel.dev` to the Coolify dashboard app domains with a
    www→apex redirect (Coolify app → Settings → Domains direction), else www breaks.

## Rollback (if anything is badly wrong)

Single DNS change: Vercel → restormel.dev → DNS → delete the explicit apex `A 77.42.125.150`
record (the implicit Vercel ALIAS resumes serving) — or via CLI:
`vercel dns rm <record-id>`. The Vercel deployment was never stopped; it is a hot standby.
Worst-case propagation ≈ TTL of the explicit record (60s default).

## Overnight outcome (agent-maintained)

- Phase B: staging dashboard + worker GREEN on Coolify; LE cert issued; catalog 200;
  warm TTFB ~200ms (better than Vercel's 290–460ms baseline). Curl-level B5 done;
  browser items above remain.
- Roadmap: PR #298 merged — the world-class dashboard roadmap is COMPLETE (28 PRs).
- PRs merged overnight: #298 (W4.5 finale), #299 (Dockerfile healthcheck 127.0.0.1 +
  worker devDeps), #300 (Forgejo deploy pipeline: docker-capable runner image + Coolify
  API triggers, serial deploys).
- Phase C: deploy workflow rewritten and merged; blocked on COOLIFY_TOKEN secret (item 4)
  and possibly runner config (item 5).
- Phase D COMPLETE: T0 = 2026-06-12T23:50:31Z. restormel.dev serves from the box with a
  valid LE cert (to 2026-09-10); catalog 200 strict-TLS; dashboard renders; both prod
  containers healthy; worker daemon sweeping (30s interval). Rollback handle: delete
  Vercel DNS record rec_5c0a7eb9483083e493b3c61a (TTL 60 → ~1 min propagation).
- Phase E: E5 already done (no Vercel crons existed); E4 TTFB recorded (box ~110–220ms
  warm vs Vercel 290–460ms baseline); E1/E2/E3 are items 6/7/10 above.
- Phase F: runbook written (docs/infra/off-github-runbook.md) — Forgejo is already the
  deploy source of truth; the remote switch + GitHub push-mirror need your admin token
  (daytime task, ~20 min).
