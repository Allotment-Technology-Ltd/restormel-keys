## Security Policy

### Supported versions

This project is pre‑launch and under active development. There are **no formal support guarantees** yet; security fixes are handled on a best‑effort basis.

### Reporting a vulnerability

If you believe you’ve found a security issue:

- **Do not** open a public GitHub issue.
- Email: `adam.boon1984+security@googlemail.com`
  - Include a short description, steps to reproduce, and any relevant logs or screenshots.
  - If you need to share sensitive details, ask for a preferred secure channel in your email.

We aim to acknowledge valid reports within **5 business days** and to provide a rough remediation plan or next steps within **15 business days**.

### In-scope areas

Security reports are most helpful when they relate to:

- Authentication and session handling (Neon Auth, OAuth flows).
- Access control around project data and API keys.
- Leakage of secrets or keys in the application, logs, or configuration.
- Data integrity or confidentiality issues in the dashboard or public API surface.

### Out-of-scope / non‑issues

The following are generally **out of scope** for this project:

- Attacks that require physical access to a device.
- Issues in third‑party services or infrastructure (e.g. Neon, Vercel, GitHub, Zuplo), unless they are clearly caused by how this project integrates with them.
- Denial‑of‑service attacks that rely on unrealistic traffic volumes.
- Vulnerabilities that only apply to debug or local‑development configurations and cannot be exploited in a typical production deployment.

### Coordinated disclosure

If a valid vulnerability is confirmed:

- We prefer **coordinated disclosure**: please give us a reasonable window to investigate and patch before any public discussion.
- We will:
  - Fix the issue or implement a mitigation.
  - Update documentation if configuration changes are required.
  - Credit reporters publicly (if desired) in the changelog or security notes once a fix is available.

