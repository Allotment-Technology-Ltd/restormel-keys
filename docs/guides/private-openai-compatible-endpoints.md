# Private and OpenAI-compatible endpoints — compatibility notes for Keys

**Status:** Reference for operators. Restormel Keys treats many self-hosted stacks as **OpenAI-compatible HTTP** providers. Exact flags vary by server; this page lists **common** integration points and **caveats**.

## Stacks (non-exhaustive)

| Stack | Typical base URL | Notes |
|-------|------------------|--------|
| **vLLM** | `http://host:8000/v1` | Widely used; confirm `model` parameter and tokenizer match your served model. |
| **NVIDIA Triton** (with appropriate frontend) | Varies | Often behind a **compatibility** or **proxy** layer; confirm path to chat/completions. |
| **NIM / NIM-shaped** | Vendor docs | Treat as OpenAI-compatible **only** when the deployment exposes that API surface. |
| **llama.cpp server** | `http://host:8080/v1` | Good for dev; watch **concurrency** and **timeouts** for production routes. |

## Keys integration checklist

1. **HTTPS** where possible; if using TLS inside VPC, ensure your **gateway or app** trusts the cert.
2. **Auth** — API key header or mTLS; store secrets in **your** secret manager or Restormel hosted integration patterns (never log raw keys).
3. **Model ID** — Use a **stable logical** ID in Keys that maps to the server’s expected `model` string.
4. **Health** — Use dashboard health / readiness if available; otherwise schedule synthetic **smoke** probes (see Testing GPU route templates).
5. **Version pin** — When you upgrade containers (e.g. new NGC tag), re-run smoke tests and update **route** metadata so policy snapshots stay meaningful.

## Caveats

- **Feature gaps:** Some servers omit `stream`, tool calling, or JSON mode; enforce via **policy** and **Testing** ACs.
- **Latency:** Cold GPUs and large KV caches affect SLOs; Keys can route traffic but does not fix **capacity** planning.

## Related

- In-app: [/keys/docs/guides/byo-gpu-vm](/keys/docs/guides/byo-gpu-vm), [/keys/docs/guides/byo-gpu-kubernetes](/keys/docs/guides/byo-gpu-kubernetes)
- [BYO-GPU and NGC accessibility](byo-gpu-ngc-accessibility.md)
