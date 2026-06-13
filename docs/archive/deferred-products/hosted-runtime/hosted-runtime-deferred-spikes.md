# Hosted runtime — deferred spikes and backlog

**Canonical phased design:** [docs/rfc/keys-no-code-route-runtime.md](../rfc/keys-no-code-route-runtime.md).  
This note tracks items **explicitly deferred** from Phase 1–2 and cross-cutting follow-ups (not duplicate SSOT).

| Item | Notes |
|------|--------|
| **Continuation tokens** | Long chains beyond a single HTTP wall clock; requires **idempotency**, storage, and replay semantics. Open question in parent RFC. |
| **Streaming** (SSE / chunked) | Multi-step and single-step streaming; product and gateway posture; see RFC open questions. |
| **Zuplo vs dashboard origin** for invoke | Latency, DDoS, and billing alignment; see RFC open questions. |
| **@restormel/keys client types** for runtime | After `runtimeContractVersion` / job API stabilise. |
| **General-purpose workflow** nodes | Out of scope for Keys hosted runtime (parent RFC non-goals). |

**When picking up work:** update [CHANGELOG.md](../../CHANGELOG.md), [STATUS.md](../../STATUS.md) / [ROADMAP.md](../../ROADMAP.md), and the owning RFC section per doc governance.
