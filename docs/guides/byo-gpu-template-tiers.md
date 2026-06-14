---
title: BYO-GPU template tiers — free vs optional paid
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-04-10
last-reviewed: 2026-06-13
review-interval: P12M
---

# BYO-GPU template tiers — free vs optional paid

**Status:** Reference. Aligns pricing copy with **no implied GPU subsidy** from Restormel.

## Principles

- **You pay** your cloud or GPU vendor for FLOPs and VMs. Restormel charges for **software, control plane, and optional packaged templates**—not for raw GPU hours unless we explicitly sell a **separate** inference SKU (not the default story).
- Marketing must **not** imply Restormel makes inference “cheap”; we make it **reachable and governable** (guides, Keys bindings, policy, Testing).

## Suggested tiers (product definition)

| Tier | Includes | Goal |
|------|-----------|------|
| **Free / OSS** | Opinionated **one-path** VM and Kubernetes guides; env snippets; health-probe examples; links to public NGC/container docs | Solo / SMB self-serve |
| **Optional paid (examples)** | Extended Terraform / Pulumi modules; multi-region matrices; org-specific review; priority updates when upstream images change | Teams that want **time saved**, not custom consulting |
| **Consulting (avoid as default)** | Bespoke design per customer | **Low margin** unless tightly scoped; prefer **productized** artifacts |

## Copy guardrails

- Use **“BYO cloud / BYO endpoint”** language.
- State clearly: **GPU and inference traffic charges appear on the customer’s bill** with their provider.

## Related

- [BYO-GPU and NGC accessibility](byo-gpu-ngc-accessibility.md)
- [GTM: PLG before enterprise](../product/gtm-plg-enterprise-sequencing.md)
