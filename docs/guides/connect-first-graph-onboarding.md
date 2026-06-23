---
title: Connect first graph onboarding (canonical)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Connect first graph onboarding (canonical)

Pick where your graph lives, wire **chat and embedding** ingestion routes in Keys, load the **starter philosophy corpus**, **describe** your graph schema with Graph Designer, then run your first ingest.

Two graph-store tiers (REC-ADR-008):

- **Zero-setup default — host-managed Postgres graph store.** No account, no connection string, no credentials. The workspace graph spine reuses Restormel's own self-hosted EU Postgres; custody stays Restormel-side. This is the low-friction **starter / retrieval** tier: ingest, store, and verified retrieval (strict and annotated trust filtering, evidence-bound claims, honest abstention) all work. It is **not** the graph-native beam-traversal reasoning engine — for that, bring your own Surreal/Neo4j (below).
- **Bring-your-own — graph-native (Surreal/Neo4j).** Connect a store you manage for the full graph-native experience (multi-hop beam traversal, argument-structure assembly, MCP graph tools). The host-managed tier is the starting point; BYO is the override, reachable any time via **Configure store**.

> Default-on is gated behind a module flag (`connectHostManagedGraphStore`) and is **OFF in production** until founder sign-off. With the flag off, onboarding is BYO Surreal as before.

In-product walkthrough: [/keys/docs/guides/connect-first-graph-onboarding](https://restormel.dev/keys/docs/guides/connect-first-graph-onboarding).

## What you need before opening the dashboard

| Account | Used for |
|---------|----------|
| _None_ for the **host-managed Postgres graph store** (zero-setup default) | Workspace graph spine — reuses Restormel's own database, no credentials |
| [Surreal Cloud](https://surrealdb.com/cloud) **or** Neo4j (optional, BYO) | Graph-native store for ideas, edges, and groups + MCP graph tools |
| Chat provider (e.g. [OpenRouter](https://openrouter.ai/), [OpenAI](https://platform.openai.com/)) | Extraction, grouping, validation, remediation |
| Embedding provider ([OpenAI](https://platform.openai.com/), [Together](https://www.together.ai/), [Voyage](https://www.voyageai.com/), or [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)) | Embedding stage |

**Minimum model capabilities:** two — one chat model and one embedding model. You can publish one chat ingestion route (shared across extraction, grouping, validation, remediation) plus one embedding route.

**Embedding note:** Domain packs may reference other models in metadata. The Connect ingest worker supports route-based embeddings for **OpenAI, Together, Voyage, and Vercel AI Gateway**. Use one of those for your first run.

## 1. Choose where your graph lives

### Option A — host-managed Postgres graph store (zero-setup default)

When the host-managed store is enabled, the workspace graph spine is **auto-provisioned on pipeline entry** — there is nothing to connect. The **Graph store** step shows it as already active ("auto-provisioned, override available"); you can go straight to routes and sources. To set or re-confirm it manually: **Connect → Pipeline → Graph store** (`?step=store`) → **Use host store**.

Done when: graph target provider is `postgres` (host-managed) and status is `ok`.

What you get on this tier: ingest → verified store → **verified retrieval** (strict supported-only or annotated trust labels, evidence-bound claims with source-anchored spans, honest abstention when nothing matches). What you do **not** get here: the graph-native beam-traversal reasoning engine and MCP graph tools — those need a BYO Surreal/Neo4j store (Option B). No parity with the graph-native engine is claimed for this tier.

### Option B — bring your own Surreal Cloud (graph-native)

1. Create a Surreal Cloud instance.
2. Copy your `wss://…` connection string ([Surreal connecting docs](https://surrealdb.com/docs/build/deployment/surrealdb-cloud/connecting/via-sdk)).
3. In the dashboard: **Connect → Pipeline → Graph store** (`/keys/dashboard/connect/pipeline?step=store`).
4. Paste the connection string, **Test connection**, then save. This overrides the host-managed default.

Done when: graph target provider is `surreal` and status is `ok`.

## 2. Add AI keys and ingestion routes

1. **Connections** (`/keys/dashboard/integrations`): add provider API keys (encrypted at rest when `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY` is configured).
2. **Connect → Models & keys** (`/keys/dashboard/connect/models`): bind a Keys project and environment.
3. Create and **publish** ingestion routes:
   - One route with a chat model for extraction (can cover grouping, validation, remediation too).
   - One route with an embedding model for the embedding stage.

Done when: both a published chat route and a published embedding route exist.

## 3. Load the starter corpus

On **Pipeline → Sources** (`/keys/dashboard/connect/pipeline?step=sources`), click **Load starter corpus (3 documents)**.

This imports three Restormel-authored philosophy demo passages (CC0), sized for a small first graph (~15–40 ideas under default chunk limits).

Done when: three parsed documents whose names start with `Starter:`.

## 4. Describe your graph schema

On **Pipeline → Domain** (`/keys/dashboard/connect/pipeline?step=domain`):

1. Click **Use suggested first-graph intent** (or paste):

   > Extract philosophical claims and argument structure from short ethics and epistemology passages—premises, conclusions, objections, and discourse relations like supports, contradicts, and responds_to.

2. Click **Generate draft**. Graph Designer samples your starter documents and returns an ontology draft.
3. Review unit types, relation types, relationship patterns, and schema mode.
4. Save as a custom domain pack (e.g. slug `my-first-graph`).

The built-in **philosophy** pack is SOPHIA-parity reference only — this walkthrough uses **describe** so you experience schema generation.

Done when: a custom (non-built-in) domain pack is saved.

## 5. Run your first ingest

1. Ensure production deployments run the ingest worker with `CONNECT_INGEST_WORKER_MODE=full` ([connect ingest worker runbook](../runbooks/connect-ingest-hosted-worker.md)).
2. **Pipeline → Run** (`/keys/dashboard/connect/pipeline?step=run`): name the run, select your custom pack and starter documents, start ingest.
3. Monitor stage progress on the run detail page.

Done when: at least one ingest job exists.

## 6. Explore your graph

- **Connect → Graph** (`/keys/dashboard/connect/graph`): browse ideas, connections, groups, validation.
- **Connect → Runs** (`/keys/dashboard/connect/ingest`): monitor jobs.

Done when: graph stats show extracted units.

## Connect model stages (reference)

| Route slot | Pipeline stages | Model type |
|------------|-----------------|------------|
| `extraction` | extracting, relating | Chat (JSON) |
| `grouping` | grouping | Chat (JSON) |
| `validation` | validating | Chat (JSON) |
| `remediation` | remediating | Chat (JSON) |
| `embedding` | embedding | Embeddings |

Contract: `@restormel/contracts/connect` (`CONNECT_MODEL_STAGES`).

## Related

- Domain packs and Graph Designer: [CONNECT-DOMAIN-PACKS.md](../product/CONNECT-DOMAIN-PACKS.md)
- Keys + Testing onboarding (separate path): [keys-testing-onboarding.md](./keys-testing-onboarding.md)
- Environment vocabulary: [guides/restormel-environment-vocabulary.md](restormel-environment-vocabulary.md)
- Security: [security-baseline.md](../governance/security-baseline.md)
