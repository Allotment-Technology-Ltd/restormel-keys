/**
 * Public npm package guidance for Keys MVP integrators.
 * Deprecated packages remain in the monorepo for maintenance; do not promote them on marketing/docs.
 */

export const MVP_PUBLIC_PACKAGES = {
  /** Web Components — preferred UI path for new apps */
  keysElements: "@restormel/keys-elements",
  keysCli: "@restormel/keys-cli",
  doctor: "@restormel/doctor",
  validate: "@restormel/validate",
  mcp: "@restormel/mcp",
  aaif: "@restormel/aaif",
  /** Graph embed (SOPHIA / preview module only) */
  graphElements: "@restormel/graph-elements",
  graphCore: "@restormel/graph-core",
} as const;

export type DeprecatedPublicPackage = {
  name: string;
  replacement: string;
  docPath: string;
};

/** Do not document as install targets on restormel.dev Keys MVP surfaces. */
export const DEPRECATED_PUBLIC_PACKAGES: DeprecatedPublicPackage[] = [
  {
    name: "@restormel/keys",
    replacement: "Keys REST (`POST /keys/v1/projects/{id}/resolve`) + Gateway key",
    docPath: "/keys/docs/guides/npm-to-rest-keys",
  },
  {
    name: "@restormel/keys-svelte",
    replacement: MVP_PUBLIC_PACKAGES.keysElements,
    docPath: "/keys/docs/compatibility",
  },
  {
    name: "@restormel/keys-react",
    replacement: MVP_PUBLIC_PACKAGES.keysElements,
    docPath: "/keys/docs/compatibility",
  },
  {
    name: "@restormel/ui-graph-svelte",
    replacement: `${MVP_PUBLIC_PACKAGES.graphElements} + Graph REST layout`,
    docPath: "/graph/docs/integration/web-components",
  },
];

/** Not part of Keys + Connect MVP — document only when Testing/Graph modules are enabled. */
export const NON_MVP_PUBLIC_PACKAGE_PREFIXES = ["@restormel/testing-"] as const;

export const REST_RESOLVE_SNIPPET = `// Resolve via Keys REST (any language / framework)
const res = await fetch(
  \`\${process.env.RESTORMEL_KEYS_BASE}/keys/v1/projects/\${projectId}/resolve\`,
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.RESTORMEL_GATEWAY_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workload: "chat" }),
  },
);
const { data } = await res.json();`;

export const ELEMENTS_INSTALL = `pnpm add ${MVP_PUBLIC_PACKAGES.keysElements}`;

export const ELEMENTS_SNIPPET = `import "${MVP_PUBLIC_PACKAGES.keysElements}";

// In HTML or any framework template:
// <rk-key-manager user-id="u_123"></rk-key-manager>
// <rk-model-selector project-id="…"></rk-model-selector>`;

export const CLI_INSTALL = `pnpm add -D ${MVP_PUBLIC_PACKAGES.keysCli}`;
