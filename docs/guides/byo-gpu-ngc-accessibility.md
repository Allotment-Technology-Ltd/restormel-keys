---
title: BYO-GPU and NGC accessibility — opinionated paths for Restormel Keys
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-04-10
last-reviewed: 2026-06-13
review-interval: P12M
---

# BYO-GPU and NGC accessibility — opinionated paths for Restormel Keys

**Status:** Reference guide. **Canonical product positioning:** Restormel does **not** host your GPU; you run **OpenAI-compatible** inference (vLLM, Triton, NVIDIA NIM–shaped servers, etc.) in **your** cloud, bare metal, or GPU rental account. Keys provides **routing, policy, aliases, and health semantics**.

## Who this is for

- **Solo / SMB:** Local or cheap cloud GPU without becoming a full-time K8s engineer.
- **Enterprise:** Same **application contract** (model IDs, policies) with GPUs in **your** VPC.

## One-path happy paths (start here)

Detailed copy-paste flows live in the in-app docs (same content):

- [/keys/docs/guides/byo-gpu-vm](/keys/docs/guides/byo-gpu-vm) — single VM + OpenAI-compatible server + Keys
- [/keys/docs/guides/byo-gpu-kubernetes](/keys/docs/guides/byo-gpu-kubernetes) — minimal Kubernetes service + Keys

## Checklist (any path)

1. **Run** an OpenAI-compatible HTTP API (`/v1/chat/completions` or your stack’s equivalent) reachable from where Keys resolves (usually your backend or gateway).
2. **Register** the base URL in Keys as a **custom / private** provider or gateway-backed endpoint (see [Private OpenAI-compatible endpoints](private-openai-compatible-endpoints.md)).
3. **Bind** a logical model ID in your project model index so apps use a **stable** name.
4. **Probe** latency and auth with a short Testing goal or `curl` (no secrets in logs).
5. **Policy** — Restrict which environments may call `private/*` (or your alias prefix).

## NGC’s role

[NVIDIA NGC](https://catalog.ngc.nvidia.com/) supplies **GPU-optimized containers and charts**. Restormel does not mirror that catalog; we **integrate at the HTTP boundary** once your container exposes an OpenAI-compatible API.

## Paid template tier

See [BYO-GPU template tiers](byo-gpu-template-tiers.md) for what is **free** (happy paths, checks) vs **optional paid** (extended Terraform/modules).

## Related

- [GTM: PLG before enterprise](../product/gtm-plg-enterprise-sequencing.md)
- [Webhooks and audit MVP](../integrations/webhooks-audit-mvp.md)
