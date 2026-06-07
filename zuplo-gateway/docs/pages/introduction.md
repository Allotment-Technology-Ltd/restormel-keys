---
title: Restormel API Reference
description: Restormel Keys Cloud API — gateway and developer portal.
---

# Restormel API Reference

`Route. Ingest. Retrieve. Verify.`

The Restormel API gives you programmatic access to Keys routing, knowledge graph
ingestion, verified retrieval, and agent context — using your own provider keys,
your own graph store, and your own data. **No proxy. No lock-in.**

## Start here

- **[Ingest your first document](/api)** — create a Knowledge Ingest job: `POST /connect/v1/ingest/jobs`
- **[Query your knowledge graph](/api)** — higher-order retrieval via the orchestrator: `POST /connect/v1/graph`
- **[Get your API key](/my-keys)** — your consumer key (`zpka_…`) for the gateway

> All API requests require a consumer key (`zpka_…`) passed as
> `Authorization: Bearer {key}`. Generate yours on the [My Consumer Key](/my-keys)
> page (sign in with GitHub).

---

**You are in the API portal** (Gateway reference and Try it). To leave this site: use the **On restormel.dev** tab in the nav for **Keys**, **Documentation**, or **Dashboard** — or click the Restormel logo to return to the product home.

The Restormel Keys API has two distinct surfaces. Use the right one for your task.

## Gateway API (this portal)

**Base URL**: `https://restormel-keys-gateway-main-bc13eba.zuplo.app`  
**Auth**: Consumer key (`zpka_...`) — [get yours here](/my-keys)  
**Use for**: Project management and Gateway key CRUD (control-plane)

## Dashboard API

**Base URL**: `https://restormel.dev/keys/dashboard/api`  
**Auth**: Gateway Key (`rk_...`) — created in the [Restormel dashboard](https://restormel.dev/keys/dashboard)  
**Use for**: Resolve, policy evaluate, route steps (runtime operations)

**Agents / MCP:** If you use `@restormel/mcp` in Cursor or other MCP hosts, see [MCP & agent setup](/integrations-mcp) for how **`RESTORMEL_EVALUATE_URL`** (full evaluate URL) differs from **`RESTORMEL_CONTROL_PLANE_URL`** (dashboard app base for `/api/projects/…`).

> Not sure which to use? If you're integrating Restormel Keys into your app, you almost certainly want the **Dashboard API**. See [Dashboard API Overview](/dashboard-api/overview).

## Authentication

Sign in with GitHub to open the **Gateway API Reference** (protected) and to use the **playground** on the right of each operation to send test requests. In the playground, pick **My consumer key (zpka_…)** as the API identity, or paste your key manually — see [My Consumer Key](/my-keys).

**Sign in:** use the account control in the portal header, or go to `/oauth/login` on this site.

