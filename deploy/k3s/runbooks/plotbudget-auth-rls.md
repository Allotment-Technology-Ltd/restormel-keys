# PlotBudget — rehearsed auth + RLS migration runbook (HIGHEST RISK)

**The security-critical core of the PlotBudget cutover: migrate the GoTrue identity system
(`auth.users` / `auth.identities` / sessions, bcrypt hashes, OAuth identities) into self-hosted
GoTrue, then re-validate the entire 158-policy RLS boundary with explicit POSITIVE and NEGATIVE
tests — first on a throwaway copy (rehearsal), passing a hard go/no-go gate, before the real
cutover.**

This runbook expands the auth/RLS portion referenced by
[`plotbudget.md`](plotbudget.md). The base runbook covers the data + Supabase-services + app move;
this one owns the part that, if wrong, **silently exposes one household's financial data to
another**.

- **Reference:** full-plan §B (the Supabase deep-dive — Auth + RLS findings), §E.1/§E.8; k3s-design
  §4.1 (`pg-plotbudget` isolates `auth`/`storage`/`pgjwt`/`pg_graphql`).
- **Route this through `restormel-high-risk-security` before the PR** (auth + RLS + financial data).

> **Why this is the highest-risk unit (the facts from the deep-dive):**
> - **42 RLS-enabled tables, 158 policies, every one keyed on `auth.uid()`** (171 occurrences).
>   **Zero** use of `auth.jwt()` / `auth.role()` / `request.jwt.claims` — so the *only* primitive
>   that must keep resolving is `auth.uid()`.
> - Pattern is uniformly **household-scoped** (`EXISTS … households WHERE owner_id/partner_user_id =
>   auth.uid()`) or **owner-scoped** (`user_id = auth.uid()`). No helper function to recreate.
> - Identity = GoTrue end-to-end: SSR sessions, per-request `getUser()`, Google+Apple OAuth, the
>   admin API, the `handle_new_user()` `auth.users → public.users` trigger, **and** a GoTrue
>   send-email hook.
> - Because **Option 1 (self-host Supabase)** is the decision, `auth.uid()` keeps resolving
>   natively under self-hosted GoTrue + PostgREST — so **all 158 policies port verbatim**. This
>   runbook's job is to *prove* that, not to assume it.

---

## 0. What moves

| Component | From | To | Sensitivity |
|---|---|---|---|
| `auth.users` (incl. **bcrypt password hashes**) | managed Supabase `auth` schema | self-hosted GoTrue on `pg-plotbudget` | **CRITICAL — credentials** |
| `auth.identities` (Google / Apple OAuth links) | managed `auth` | self-hosted GoTrue | **CRITICAL — identity** |
| Sessions / refresh tokens | managed `auth` | self-hosted GoTrue | High (may force re-login if not migrated) |
| `handle_new_user()` trigger + `public.users` provisioning | managed `public`/`auth` | recreated on target | High |
| **158 RLS policies** (`auth.uid()`-keyed) | `public` (+ `storage`) | restored verbatim | **CRITICAL — the boundary** |
| Storage bucket policies (`vault-documents`, `avatars`) | `storage` schema | self-hosted Storage + `pg-plotbudget` | High |
| GoTrue Send-Email Hook (`send-resend-email`) | Supabase edge function | self-hosted endpoint, GoTrue hook URL re-pointed | Medium |

**Key facts that govern the move:**
- **Self-hosted GoTrue uses its own JWT secret.** The managed anon + service-role keys stop working;
  re-mint both against the self-hosted secret. The JWT `sub` claim must still equal the user's UUID
  so `auth.uid()` resolves the same value — **verify the `sub` mapping explicitly**.
- **bcrypt hashes are portable.** GoTrue stores bcrypt in `auth.users.encrypted_password`; importing
  the rows verbatim preserves logins **without** a password reset — *if* the row shape matches the
  self-hosted GoTrue version. Confirm the GoTrue schema version parity (managed = 2.186) and migrate
  `auth.users` with its columns intact.
- **OAuth must be re-registered** on the self-hosted GoTrue (new callback/redirect URIs at Google +
  Apple). The `auth.identities` rows carry the provider linkage; the OAuth *app* itself is re-created.

---

## 1. REHEARSAL FIRST (throwaway copy) — mandatory

> **Never rehearse against the live managed project's writable endpoint.** Rehearse against a
> **throwaway restore** of a dump, on a throwaway `pg-plotbudget-rehearsal` CNPG cluster +
> throwaway self-hosted GoTrue/PostgREST. Tear it all down after. No real user touches it; no live
> traffic; no production DNS.

### 1.1 Build the rehearsal copy
1. Take a **point-in-time dump** of the managed Supabase DB (`public` + `auth` + `storage`) — the
   same `pg_dump --schema=public --schema=auth --schema=storage` as the real run.
2. Restore into a **throwaway** `pg-plotbudget-rehearsal` CNPG cluster (separate namespace, separate
   PVCs, separate object-store prefix — never the prod paths).
3. Deploy throwaway GoTrue + PostgREST + Storage + Kong pointed at the rehearsal cluster, with a
   throwaway JWT secret and throwaway (test) OAuth apps.
4. Copy a representative sample of storage objects (or a small fixture set) into a throwaway bucket.

### 1.2 Verify the auth import on the copy
- [ ] `auth.users` row count matches the dump.
- [ ] A **known test user** can log in with their existing password (bcrypt verified — **no reset**).
- [ ] An OAuth identity links correctly via the throwaway Google/Apple test app.
- [ ] The issued JWT's `sub` == the user's `auth.users.id` (so `auth.uid()` resolves the right UUID).
- [ ] The `handle_new_user()` trigger fires on a new signup (a new `public.users` row appears).

### 1.3 RLS revalidation on the copy — POSITIVE and NEGATIVE (the core test)

> Goal: prove **every** one of the 158 policies still draws the household/owner boundary correctly
> under self-hosted GoTrue + PostgREST. Two users in two different households are enough to exercise
> both directions on every table.

**Fixture:**
- `userA` in `householdA`; `userB` in `householdB`. Each owns rows across all RLS-protected tables
  (vault documents, transactions, budgets, accounts, shopping lists, etc.).

**Run each test *as the user* through PostgREST** (so the real `auth.uid()` resolution path is
exercised — not a `service_role` query that bypasses RLS, and not a bare `SET ROLE`). Drive it with
each user's JWT against the PostgREST endpoint, the same way the app does.

| # | Test | Expectation |
|---|---|---|
| **P1** | `userA` lists rows on each RLS table | returns **only** `householdA` / `userA` rows |
| **P2** | `userA` reads a specific own-household row by id | **succeeds** |
| **P3** | `userA` writes (insert/update/delete) an own-household row | **succeeds** (write policies, not just read) |
| **P4** | `userA` downloads an own `vault-documents` object via signed URL | **succeeds** |
| **N1** | `userA` requests `householdB`'s rows on each RLS table | returns **zero rows** (not an error leak — empty) |
| **N2** | `userA` reads `userB`'s specific row by **known id** | returns **nothing** (no row leak by direct id) |
| **N3** | `userA` attempts a write to a `householdB` row | **denied / affects zero rows** |
| **N4** | `userA` attempts to fetch `userB`'s private `vault-documents` object | **denied** (storage RLS) |
| **N5** | Anon (no JWT) hits any protected table | returns **zero rows** / unauthorized |

**Coverage requirement:** P1/N1 must be run **across all 158 policies' tables**, not a sample.
Script it to enumerate every RLS-enabled table (`SELECT … FROM pg_policies`) and assert that, for
each, `userA` sees a non-zero own count (positive) **and** a zero cross-household count (negative).
A single table where the negative test returns ≥ 1 cross-household row is an **automatic NO-GO**.

```sql
-- Enumerate the policy surface to drive the test matrix (run on the rehearsal copy):
SELECT schemaname, tablename, COUNT(*) AS n_policies
FROM pg_policies
WHERE schemaname IN ('public','storage')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;
-- Assert the total reconciles to the expected 158 across 42 tables before running the matrix.
```

### 1.4 Rehearsal exit criteria
- [ ] Auth import verified (login, OAuth, JWT `sub`, trigger).
- [ ] **Every** positive test passes on **every** RLS table.
- [ ] **Every** negative test passes on **every** RLS table (zero cross-household leakage anywhere).
- [ ] Storage RLS positive + negative pass.
- [ ] Email hook fires from throwaway GoTrue.
- [ ] Timing captured: how long the dump → restore → auth import → full RLS matrix actually took
      (this sizes the real maintenance window).
- [ ] Throwaway environment **torn down** (cluster, PVCs, object-store prefix, test OAuth apps).

---

## 2. GO / NO-GO GATE (before the real cutover)

A single, explicit decision point. The real PlotBudget cutover ([`plotbudget.md`](plotbudget.md))
**must not start** until this gate is GO.

### GO requires ALL of:
1. **Auth import proven** on the rehearsal copy — known user logs in with existing password (no
   reset), OAuth links, JWT `sub` == user UUID, `handle_new_user()` trigger fires.
2. **RLS matrix 100% green** — every positive test passes and **every negative test passes on every
   one of the 158 policies** (zero cross-household leakage, by-list and by-known-id, including
   storage). Evidence: the full test-matrix output, retained.
3. **OAuth re-registration confirmed** — Google + Apple apps created for the self-hosted GoTrue
   callback, redirect URIs added, client secrets in Infisical.
4. **Email hook verified** end-to-end from the (throwaway, then prod-configured) GoTrue.
5. **Rollback proven** — re-pointing the Supabase URL + keys (+ DNS) back to managed Supabase
   restores service in a dry-run; managed project confirmed warm + authoritative.
6. **Window sized** — rehearsal timing fits the agreed maintenance window with margin.
7. **Two operators** committed for the real window; `restormel-high-risk-security` review on record;
   founder sign-off on the gate.

### NO-GO if ANY of:
- Any negative RLS test returns ≥ 1 cross-household row, on any table (data-leak — **hard stop**).
- A user cannot log in with their existing password after import (auth regression).
- The JWT `sub` does not map to `auth.uid()` (the whole boundary mis-resolves).
- OAuth or the email hook cannot be made to work on self-hosted GoTrue.
- Rollback cannot be demonstrated.

**NO-GO action:** fix the defect, rebuild the rehearsal copy, re-run §1 in full. Do not partially
re-test — re-run the **entire** matrix. Record the NO-GO and the cause in `migration-log.md`.

---

## 3. REAL cutover (only after GO)

Runs inside the [`plotbudget.md`](plotbudget.md) maintenance window. The steps mirror the rehearsal
exactly, against **prod** targets:

1. Freeze the managed source (app offline; no writes) — see `plotbudget.md` §2.1.
2. `pg_dump` `public` + `auth` + `storage` from the **live** managed project.
3. Restore into the **prod** `pg-plotbudget` CNPG cluster.
4. Migrate storage objects (prod buckets).
5. **Re-run the auth verification + the full 158-policy positive/negative RLS matrix against the
   prod target** (the HARD GATE inside the window — `plotbudget.md` §2.5). Any failure → roll back.
6. Flip the Supabase URL + re-minted keys; redeploy the app (`plotbudget.md` §2.6).
7. Smoke test, including a live positive + negative RLS spot-check (`plotbudget.md` §2.7).
8. Keep managed Supabase warm + authoritative for the soak (≥ 72 h).

---

## 4. Rollback (re-point the Supabase URL + keys)

Same as [`plotbudget.md`](plotbudget.md) §3: re-point `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` +
anon/service-role keys (and DNS) back to the **managed** Supabase project, which was frozen (not
mutated) and stays authoritative. Because the app was offline on the source during the window there
are no divergent writes; rollback is a URL/key/DNS re-point — no data restore needed.

File an incident record (REC-TPL-004); run `restormel-high-risk-security` on the finding.

---

## 5. Validation checklist (auth/RLS specific)

- [ ] `auth.users` + `auth.identities` row counts match source; bcrypt logins work without reset.
- [ ] JWT `sub` == user UUID; `auth.uid()` resolves identically to managed Supabase.
- [ ] `handle_new_user()` trigger recreated and firing.
- [ ] Google + Apple OAuth work on self-hosted GoTrue.
- [ ] **All 158 RLS policies: positive tests pass (own data readable + writable).**
- [ ] **All 158 RLS policies: negative tests pass (cross-household data NOT readable, by-list and
      by-known-id, including storage objects).**
- [ ] Anon access returns nothing on protected tables.
- [ ] Email hook fires end-to-end.
- [ ] Full RLS test-matrix output retained as evidence; high-risk-security review on record;
      founder go/no-go recorded.
- [ ] Managed Supabase kept warm + authoritative through the soak.
