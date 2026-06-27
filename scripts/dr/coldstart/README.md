# Stage-C cold-start DR drill — push-button runbook

**REC-PLAN-021** crown-jewels off-cluster disaster-recovery. This harness restores the **whole estate**
from the **fsn1 S3 store alone** into a **fresh throwaway Hetzner box**, proves it works, measures the
**RTO**, writes an **evidence record**, and **destroys the box**. It is the **Stage-C gate**: a full PASS
via the `etcd-s3` path (with the §3d weekly per-jewel drill GREEN) is what *licenses* the irreversible
Stage D/E ( `.150` standby delete → BX11 cancel → `.150` decommission ).

> **The founder runs this**, on a trusted workstation, with the **offline escrow key in hand**. That key
> (`~/restormel-escrow-primary.key`) never leaves the founder — never in the cluster, Infisical, or git.
> That single-custody control is the heart of the DR design; the harness is built around it, not against it.

## Two drills (pick by what you're proving)

| Drill | Script | Proves | Cost |
|-------|--------|--------|------|
| **Full cold-start** (this runbook) | `dr-coldstart-drill.sh` | whole-estate orchestration + RTO on a real throwaway box via the `etcd-s3` path — the Stage-C **box** gate; apps live + 200 | a temp Hetzner box, **founder-supervised** |
| **Local jewels-proof** (§3d weekly) | `jewels-proof-local.sh` | **9/10 jewels**: DB jewels J3/J4/J6/J7/J8 → live Postgres (`barman-cloud-restore`), escrow **C1/C2**, and **J10** etcd → cluster state recovers — all in throwaway Docker | **£0**, ~3 min |

Run the **local jewels-proof weekly** (it needs only Docker + age + aws + the escrow key; no box, no
prod touch — values never printed, full teardown on exit). It is the fast, cheap confidence that the
*data + cluster-state* recover; the full cold-start is the periodic proof that the *orchestration*
recovers live. First green run recorded as evidence `REC-EVID-005` (2026-06-27); wired as a weekly macOS
launchd agent (`tech.allotmentology.dr-jewels-proof`).

> **Why the live cold-start stays founder-supervised (never unattended):** restoring the prod etcd into a
> *networked* K3s starts the Hetzner **CCM** (cloud token) + **external-dns**, which could reconcile
> against the real Hetzner project and **mutate/tear down prod**. The full box drill must therefore be run
> with the box **egress-firewalled to the S3 store only** before the restore. The weekly local drill avoids
> this entirely by restoring etcd into a *standalone* etcd (no controllers, no token).

```bash
# weekly (fetches S3 creds from Infisical); REPLAY_TO_LATEST=1 for current-state instead of backup-end
bash scripts/dr/coldstart/jewels-proof-local.sh
# real-disaster mode (Infisical down): supply the offline DR-kit creds via env
DR_S3_ACCESS_KEY_ID=… DR_S3_SECRET_ACCESS_KEY=… bash scripts/dr/coldstart/jewels-proof-local.sh
```

### The offline DR kit (founder-held)

- **Local working copy** (what the drills read): `~/.config/restormel/dr-kit/escrow-primary.key`
  (`0600`, protected at rest by FileVault). The harness defaults to this path, falling back to the legacy
  `~/restormel-escrow-primary.key`. The weekly drill gets the S3 creds + restic passphrase from Infisical.
- **Encrypted backup** (Mac-loss / Infisical-down): an `age -p` passphrase-encrypted `dr-kit.age`
  (escrow key + `RESTIC_PASSWORD` + fsn1 S3 read keys + a recovery README) in Google Drive
  `…/Restormel-DR-Kit/`. Drive holds only ciphertext; the passphrase lives in a password manager / safe,
  never in Drive. Decrypting it does not touch the automation (which uses the local key) — that's the point.

## What it guarantees (safety)

- **Read-only against the store.** Only `restic restore` / `aws s3 cp|ls|sync` (GET/LIST). Never
  `restic forget|prune|init`, never an S3 write/delete to a jewel. The in-cluster restic Job
  (`manifests/50-`) likewise omits `forget`/`prune`.
- **Never touches prod.** `assert_no_prod_dns` aborts if any prod hostname resolves off the scratch box.
  Scratch DNS (`*.dr-drill.internal`) lives only in the temp box's `/etc/hosts` and dies with the box.
  No prod cluster / `.150` / BX11 / real DNS is read-for-write or mutated.
- **No secret values ever printed.** Escrow plaintext is only ever *piped* (into `kubectl create`,
  `age -d`, `sha256sum`); it lands only in a `600` temp file that is `shred`-ed on exit. Assertions are
  over **hashes / row-count floors / canary-match booleans / HTTP status** — never plaintext.
- **Fail-closed + always cleans up.** Any step failure stops the whole drill (a partial pass is a FAIL),
  but the box is **still destroyed** and an evidence record is **still written**.

## Prerequisites

Tools on the workstation (the harness preflight asserts them):
`age hcloud aws restic skopeo kubectl helm jq ssh git curl` + `sha256sum`/`shasum`.

You hold:
- the **offline** age key `~/restormel-escrow-primary.key` (opens `eso-bootstrap.age` → C1 MI + C2 J5),
- the **restic passphrase**, the **fsn1 S3 keys** (read-only-scoped if you provisioned one — F2),
- an **hcloud token** and an **hcloud-registered SSH key** for the temp box — the existing
  `adam@allotment-hetzner` (local private half `~/.ssh/id_hetzner_allotment`) works; no new key needed.

## Run it (one command, after the env preamble)

Fetch each secret **scoped** (never bulk-inject, never echo). Example using the self-hosted Infisical
(`restormel-ops` / `prod`) — substitute your own source if different:

```bash
# restormel-ops projectId is non-secret (see the restormel-infra-access skill); set it once.
OPS_PID="<restormel-ops-projectId>"; INF="--projectId=$OPS_PID --env=prod --domain=https://secrets.restormel.dev --plain"
export HCLOUD_TOKEN="$(infisical secrets get HCLOUD_TOKEN $INF)"
export RESTIC_PASSWORD="$(infisical secrets get RESTIC_PASSWORD $INF)"
export AWS_ACCESS_KEY_ID="$(infisical secrets get HETZNER_S3_FSN1_ACCESS_KEY_ID $INF)"
export AWS_SECRET_ACCESS_KEY="$(infisical secrets get HETZNER_S3_FSN1_SECRET_ACCESS_KEY $INF)"
export AWS_DEFAULT_REGION=fsn1
# Existing Hetzner key (no new key needed): hcloud-registered name + matching local private key.
export DR_DRILL_SSH_KEY="adam@allotment-hetzner"
export DR_DRILL_SSH_PRIVKEY="$HOME/.ssh/id_hetzner_allotment"
export ESCROW_IDENTITY="$HOME/restormel-escrow-primary.key"   # OFFLINE key — stays on this machine

bash scripts/dr/coldstart/dr-coldstart-drill.sh
```

`DR_DRILL_SSH_KEY` is the name of the public key already registered in Hetzner Cloud; the harness
injects it into the temp box. `DR_DRILL_SSH_PRIVKEY` is the **matching local private key** the harness
uses to SSH in — set it and you don't need the key in ssh-agent. (If omitted, the harness falls back to
ssh-agent / your default `~/.ssh/id_*`.) The two must be a pair — `adam@allotment-hetzner` ↔
`~/.ssh/id_hetzner_allotment` (verified same fingerprint `da:1f:…`).

That's it. The script provisions the box, runs Steps 0–6, prints `STEP n: PASS`, writes the evidence
record into a temp dir (path printed at the end), and destroys the box.

### Optional overrides (sane defaults baked in)

| Var | Default | When to set |
|-----|---------|-------------|
| `TEMP_BOX_TYPE` | `cx33` | bigger box for a faster run (F3) |
| `SCRATCH_DOMAIN` | `dr-drill.internal` | only if it collides with something you use |
| `SCRATCH_STORAGECLASS` | `local-path` | fresh k3s default; change only for a custom box image |
| `INFISICAL_IMAGE` / `FORGEJO_IMAGE` | ceremony pins (`v0.154.6` / `8.0.3`) | if the live versions rotated |
| `CANARY_SECRET_PATH` | `/dr/canary` | confirm the canary's location in the `restormel` project |
| `CANARY_PROJECT_ID` / `CANARY_ENV` | `f0165998…` / `prod` | if the canary lives elsewhere |
| `J2_SAMPLE_REPO` | `dashboard` | a repo present in the registry mirror |
| `PG_ROW_FLOOR` / `PG_FLOOR_TABLE` / `SURREAL_FLOOR_TABLE` | `1` / `information_schema.tables` / `source` | tighten the row-count floor to a real table |
| `DR_DRILL_SSH_PRIVKEY` | _(unset → ssh-agent)_ | local private key to SSH the temp box (e.g. `~/.ssh/id_hetzner_allotment`) — must pair with `DR_DRILL_SSH_KEY` |
| `DRILL_FULL_ROUNDTRIP` | `0` | `1` for the deepest push→CI→registry→Argo check (adds RTO — F4) |
| `KEEP_BOX` | `0` | `1` to inspect the box after (you then destroy it manually) |

## The seven steps (the dependency chain)

| Step | Proves | Jewels | Decisive assertion |
|------|--------|--------|--------------------|
| 0 | etcd restores from S3 (or clean-k3s fallback) | J10 | CRDs + app-of-apps present |
| 1 | **Infisical decrypts from restored ciphertext + escrow key** | J4, J5 | **C2 canary sha256 MATCH** |
| 2 | Forgejo repos + registry mirror restore | J1, J2, J3 | `git fsck` clean; image manifest+layer pull |
| 3 | **ESO root recreatable from escrow alone** | C1 | 5 ClusterSecretStores → Valid |
| 4 | platform rebuilds | — | 0 ImagePullBackOff; 0 ExternalSecret SyncError |
| 5 | data restores | J6/7/8, J9 | CNPG `-dr` healthy; row counts ≥ floor |
| 6 | apps serve on the scratch host | — | app `200`; ESO stores Valid |

**C2** (Step 1) is the single most important assertion: it proves the J4 ciphertext + the J5 master key
from escrow are a **usable recovery pair**. A mismatch is a CRITICAL **STOP** on the entire `.150` program.

## After the run — file the evidence

The harness emits a pre-filled evidence record (`class: evidence`, tier-3, id placeholder `REC-EVID-XXX`)
in the temp dir; its path is printed at the end. **File it via the `restormel-isms-records` skill**
(append-only under `evidence/posture/`): pick the next free `REC-EVID-NNN`, then run
`node scripts/records/register.mjs` to regenerate the register. The recorded **RTO becomes the documented
DR RTO**. (The WS6 `DESIGN.md` template predates the current schema and says `class: posture` / `REC-POS-DR`;
the harness emits the schema-correct `class: evidence` form — follow the harness output, not the design template.)

**Stage C is SATISFIED — and only then may you run the irreversible Stage D/E — when:** every step PASSes
via the **`etcd-s3`** path (not gitops-fallback), **C2 = MATCH**, **C1 recreated from escrow alone**, the
**§3d weekly drill is GREEN**, and the RTO is recorded + accepted. A FAIL / `gitops-fallback`-only /
`PASS-PARTIAL` run does **not** license Stage D/E.

## Notes

- The harness restores **host-side** by default (restic creds stay on the workstation). `manifests/50-`
  is the in-cluster alternative if you prefer the fetch to run on the box.
- A few coordinates (exact canary location, per-jewel dump filename, image pins) are run-time values you
  confirm on the first run; each has a default matching the 2026-06-25 ceremony + the gitops manifests.
- Design + gate definition: `DESIGN.md` (WS6) and `~/.config/restormel/crown-jewels-dr/` blueprint.
