import type { ZudokuConfig } from "zudoku";
import { createApiIdentityPlugin } from "zudoku/plugins";

/** Product site (Keys, Docs, Dashboard). Same-tab so Neon session applies for SSO. */
const RESTORMEL_SITE = (
  process.env.ZUDOKU_PUBLIC_RESTORMEL_SITE_ORIGIN ?? "https://restormel.dev"
).replace(/\/$/, "");

const config: ZudokuConfig = {
  site: {
    title: "Restormel Keys — API portal",
    logo: {
      src: { light: `${RESTORMEL_SITE}/restormel-lockup-nav.svg`, dark: `${RESTORMEL_SITE}/restormel-lockup-nav.svg` },
      href: `${RESTORMEL_SITE}/keys`,
      alt: "Restormel",
      width: "134px",
    },
  },
  navigation: [
    {
      type: "category",
      label: "On restormel.dev",
      icon: "arrow-left",
      items: [
        {
          type: "link",
          label: "Keys (product)",
          to: `${RESTORMEL_SITE}/keys`,
          target: "_self",
          icon: "home",
        },
        {
          type: "link",
          label: "Documentation",
          to: `${RESTORMEL_SITE}/keys/docs`,
          target: "_self",
          icon: "book-open",
        },
        {
          type: "link",
          label: "Dashboard",
          to: `${RESTORMEL_SITE}/keys/dashboard`,
          target: "_self",
          icon: "layout-dashboard",
        },
      ],
    },
    {
      type: "category",
      label: "Getting started",
      items: [
        { type: "doc", file: "introduction" },
        { type: "doc", file: "how-it-fits-together" },
        { type: "doc", file: "authentication-guide" },
      ],
    },
    {
      type: "category",
      label: "Dashboard API",
      items: [
        { type: "doc", file: "dashboard-api/overview" },
        { type: "doc", file: "dashboard-api/resolve" },
        { type: "doc", file: "dashboard-api/policies-evaluate" },
        { type: "doc", file: "dashboard-api/routes-steps" },
      ],
    },
    { type: "link", to: "/api", label: "Gateway API Reference" },
    { type: "link", to: "/my-keys", label: "My Consumer Key" },
  ],
  redirects: [{ from: "/", to: "/introduction" }],
  apis: [
    {
      type: "file",
      input: "../config/routes.oas.json",
      path: "/api",
      options: {
        disablePlayground: false,
        disableSidecar: false,
      },
    },
  ],
  docs: {
    files: "./pages/**/*.{md,mdx}",
  },
  authentication: {
    type: "openid",
    // Zudoku warns if the clientId env var isn't public-prefixed. Keep backwards
    // compat with the older name while letting hosted builds use the public one.
    clientId: process.env.ZUDOKU_PUBLIC_RESTORMEL_OIDC_CLIENT_ID ?? process.env.RESTORMEL_OIDC_CLIENT_ID ?? "",
    issuer: "https://restormel.dev/keys/auth",
    scopes: ["openid", "profile", "email"],
  },
  /** /my-keys stays public so users can read help + use a real Sign in navigation. */
  protectedRoutes: ["/api/*"],
  plugins: [
    createApiIdentityPlugin({
      getIdentities: async (context) => {
        let cachedKey: string | null = null;
        return [
          {
            id: "consumer-key",
            label: "My consumer key (zpka_...)",
            authorizeRequest: async (request) => {
              if (!cachedKey) {
                const req = new Request("https://restormel.dev/keys/dashboard/api/consumer-key");
                const signed = context.authentication?.signRequest ? context.authentication.signRequest(req) : req;
                const res = await fetch(signed);
                const json = (await res.json().catch(() => ({}))) as any;
                if (!res.ok) throw new Error(json?.error ?? "Unable to load consumer key");
                if (typeof json?.key !== "string" || !json.key.startsWith("zpka_")) {
                  throw new Error("Invalid consumer key response");
                }
                cachedKey = json.key;
              }
              request.headers.set("Authorization", `Bearer ${cachedKey}`);
              return request;
            },
          },
        ];
      },
    }),
  ],
};

export default config;

