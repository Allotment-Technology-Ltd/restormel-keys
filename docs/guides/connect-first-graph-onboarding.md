# Connect first graph onboarding (canonical)

Single operational path: connect **Surreal Cloud**, wire **chat and embedding** ingestion routes in Keys, load the **starter philosophy corpus**, **describe** your graph schema with Graph Designer, then run your first ingest.

In-product walkthrough: [/keys/docs/guides/connect-first-graph-onboarding](https://restormel.dev/keys/docs/guides/connect-first-graph-onboarding).

## What you need before opening the dashboard

| Account | Used for |
|---------|----------|
| [Surreal Cloud](https://surrealdb.com/cloud) | Graph store for ideas, edges, and groups |
| Chat provider (e.g. [OpenRouter](https://openrouter.ai/), [OpenAI](https://platform.openai.com/)) | Extraction, grouping, validation, remediation |
| Embedding provider ([OpenAI](https://platform.openai.com/), [Together](https://www.together.ai/), [Voyage](https://www.voyageai.com/), or [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)) | Embedding stage |

**Minimum model capabilities:** two — one chat model and one embedding model. You can publish one chat ingestion route (shared across extraction, grouping, validation, remediation) plus one embedding route.

**Embedding note:** Domain packs may reference other models in metadata. The Connect ingest worker supports route-based embeddings for **OpenAI, Together, Voyage, and Vercel AI Gateway**. Use one of those for your first run.

## 1. Connect Surreal Cloud

1. Create a Surreal Cloud instance.
2. Copy your `wss://…` connection string ([Surreal connecting docs](https://surrealdb.com/docs/build/deployment/surrealdb-cloud/connecting/via-sdk)).
3. In the dashboard: **Connect → Pipeline → Graph store** (`/keys/dashboard/connect/pipeline?step=store`).
4. Paste the connection string, **Test connection**, then save.

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
