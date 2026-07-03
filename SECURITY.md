## Security Policy

### Supported versions

This project is pre-launch and under active development. There are **no formal support guarantees** yet; security fixes are handled on a best-effort basis.

### Reporting a vulnerability

If you believe you've found a security issue:

- **Do not** open a public issue on GitHub or Forgejo.
- Email: `adam.boon1984+security@googlemail.com`
  - Include a short description, steps to reproduce, and any relevant logs or screenshots.
  - If you need to share sensitive details, ask for a preferred secure channel in your first email.

We aim to acknowledge valid reports within **5 business days** and to provide a rough remediation plan or next steps within **15 business days**.

### Infrastructure and hosting

Production and staging run on **Coolify** deployed to self-hosted Hetzner boxes. **Forgejo** (`git.allotmentology.tech`) is the primary git host and CI runner; GitHub is a push-mirror and fallback. The operational database is a self-hosted Postgres instance on-box. Secrets and credentials are managed via Coolify environment variables and never committed to the repository.

### In-scope areas

Security reports are most helpful when they relate to:

- Authentication and session handling (Better Auth, OAuth flows).
- Access control around project data and API keys.
- Leakage of secrets or keys in the application, logs, or configuration.
- Data integrity or confidentiality issues in the dashboard or public API surface.
- Host or infrastructure exposure: SSH hardening, exposed admin ports, Coolify control-plane misconfig, or Traefik/reverse-proxy misconfiguration.
- Supply-chain issues: malicious or compromised dependencies, secrets committed to the Forgejo or GitHub repositories, CI workflow poisoning.
- **Restormel Testing** (`@restormel/testing-*` on npm, composite Action under `packages/testing-github-action/`): credential handling in CI configs, `judge_rubric` / agent flows that could exfiltrate page content to third parties, or bypass of documented egress controls. See [docs/security/vulnerability-management.md](docs/security/vulnerability-management.md) and [docs/archive/testing/testing/testing-autonomous-browsing-threat-addendum.md](docs/archive/testing/testing/testing-autonomous-browsing-threat-addendum.md).

**Reporting scope for published packages:** Vulnerabilities that affect **consumers** of the Testing CLI or Action (e.g. path traversal from untrusted config, unsafe defaults when running in CI) are in scope. Purely stylistic or non-security test flakes are not.

### Vulnerability management and SLAs

We triage reported and scanner-detected vulnerabilities against severity SLAs. See [docs/security/vulnerability-management.md](docs/security/vulnerability-management.md) for the full triage funnel, SLA table, suppression policy, and self-healing Renovate loop.

Summary:

| Severity (CVSS) | Remediation SLA | CI gate behaviour |
|---|---|---|
| Critical 9.0–10.0 (or KEV) | 72 h (24 h if KEV-listed) | Block — fail build on fixable |
| High 7.0–8.9 | 7 days | Block — fail build on fixable |
| Medium 4.0–6.9 | 30 days | Warn + auto-open tracked issue |
| Low 0.1–3.9 | 90 days | Informational |

The CI scanning gate (OSV-Scanner + gitleaks + pnpm audit + Trivy) runs on every PR to `main` in the Forgejo pipeline and is a required status check.

### Out-of-scope / non-issues

The following are generally **out of scope**:

- Attacks that require physical access to a device.
- Issues in third-party services or infrastructure unless clearly caused by how this project integrates with them. (Note: Coolify, SurrealDB, Traefik, Forgejo, and Hetzner are part of our hosting stack — misconfigurations in how we deploy or expose these are in scope; bugs in the services themselves are not.)
- Denial-of-service attacks that rely on unrealistic traffic volumes.
- Vulnerabilities that only apply to debug or local-development configurations and cannot be exploited in a typical production deployment.

### BYOK testing scope

Restormel Testing is designed to drive real browser automation and may have access to authenticated pages depending on the caller's configuration. Research that demonstrates exfiltration of page content beyond the documented controlled egress policy, or bypass of the `judge_rubric` trust boundary, is in scope and treated as High or Critical.

### Coordinated disclosure

If a valid vulnerability is confirmed:

- We prefer **coordinated disclosure**: please give us a reasonable window to investigate and patch before any public discussion.
- We will:
  - Fix the issue or implement a mitigation.
  - Update documentation if configuration changes are required.
  - Credit reporters publicly (if desired) in the changelog or security notes once a fix is available.
