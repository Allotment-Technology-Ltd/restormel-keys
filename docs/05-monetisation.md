# Restormel Keys — Monetisation

---

## 1. Open-source vs paid

**Open-source (MIT):** Headless core + UI packages + CLI. Use locally/in-process with builder-managed provider access (env/secrets) or gateway-backed setups.

**Paid (cloud-managed):** Hosted control plane value: dashboard, advanced routing/policies, health checks, analytics, audit trail/team features, and higher limits. Restormel does **not** need to custody raw provider secrets by default in v1.

---

## 2. Pricing tiers

| | Free | Pro | Team | Enterprise |
|---|------|-----|------|------------|
| **Price** | £0 | £19/mo | £49/mo | £149/mo |
| **Annual** | — | £192/yr | £468/yr | £1,428/yr |
| **Users** | 1 | 3 | Unlimited | Unlimited |
| **Integrations/connections** | 3 | 10 | 50 | Custom |
| **Requests/mo** | 10K | 100K | Unlimited | Unlimited |
| **Cloud API** | None | 100 calls | 5,000 calls | Unlimited |
| **Policies & routes** | Local | Cloud | Cloud + team workflows | Cloud + custom |
| **Health & fallback** | Local | Basic | Full | Full + SLA |
| **Analytics** | No | Basic | Full | Full + export |
| **Audit trail** | No | No | Basic | Full |
| **Team features** | No | No | Yes | Yes + RBAC |
| **SSO** | No | No | No | Yes |
| **Managed edge** | No | Optional | Optional | Optional + custom |

### Overage: based on control-plane usage (requests, integrations, analytics retention).

---

## 3. Revenue sequence

Phase 1 (adoption): £0. Phase 2 (first revenue, ~week 10): £100-500/mo. Phase 3 (team, ~week 16): £500-2,000/mo. Phase 4 (enterprise, month 6+): £2,000+/mo.

### Break-even: 3-6 Pro customers. Fixed costs ~£50-100/mo.

---

## 4. Pricing principles

1. Charge for durable value, not plumbing.
2. No per-seat pricing.
3. Open-source the core, monetise the hosted platform.
4. Usage-based with predictable floors.
5. Don't charge for commodity layers.
