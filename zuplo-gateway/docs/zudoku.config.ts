import type { ZudokuConfig } from "zudoku";
import { createApiIdentityPlugin } from "zudoku/plugins";
// Neo-brutalist portal styling lives in a real CSS file and is injected via
// theme.customCss below. See restormel-theme.css for selector confidence notes.
import restormelTheme from "./restormel-theme.css?raw";

/** Product site (Keys, Docs, Dashboard). Same-tab so Neon session applies for SSO. */
const RESTORMEL_SITE = (
  process.env.ZUDOKU_PUBLIC_RESTORMEL_SITE_ORIGIN ?? "https://restormel.dev"
).replace(/\/$/, "");

const config: ZudokuConfig = {
  site: {
    title: "Restormel API Reference",
    logo: {
      src: { light: `${RESTORMEL_SITE}/restormel-lockup-nav.svg`, dark: `${RESTORMEL_SITE}/restormel-lockup-nav.svg` },
      href: `${RESTORMEL_SITE}/keys`,
      alt: "Restormel",
      width: "134px",
    },
  },
  // ── Restormel design system ──
  // Maps the Restormel tokens onto Zudoku's shadcn theme variables. Hex values
  // are used verbatim (Zudoku only HSL-wraps space-separated triples). Body =
  // DM Sans, code = Space Mono (both built-in Google fonts). The serif slot is
  // repurposed to load Barlow Condensed for display headings (see CSS file).
  theme: {
    fonts: {
      sans: "DM Sans",
      mono: "Space Mono",
      serif: {
        url: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&display=swap",
        fontFamily: "'Barlow Condensed', sans-serif",
      },
    },
    light: {
      background: "#F3EAD0", // warm cream — page background
      foreground: "#0C0C0C", // near-black ink — primary text
      card: "#FFFEF0", // warm white — card/panel surfaces
      cardForeground: "#0C0C0C",
      popover: "#FFFEF0",
      popoverForeground: "#0C0C0C",
      primary: "#FFD600", // yellow — primary actions / active states
      primaryForeground: "#0C0C0C",
      secondary: "#E8DFBF", // deep cream — secondary surfaces
      secondaryForeground: "#0C0C0C",
      muted: "#E8DFBF",
      mutedForeground: "#3A3530", // body/muted text
      accent: "#E8DFBF", // subtle hover surface (yellow reserved for primary/active)
      accentForeground: "#0C0C0C",
      destructive: "#0C0C0C", // palette has no red — DELETE/errors render as ink
      destructiveForeground: "#FFFEF0",
      border: "#0C0C0C", // 2px solid ink border system
      input: "#0C0C0C",
      ring: "#FFD600", // yellow focus ring
      radius: "0rem", // square corners (neo-brutalist)
    },
    dark: {
      background: "#1A1917",
      foreground: "#F3EAD0", // cream becomes the text colour
      card: "#242220",
      cardForeground: "#F3EAD0",
      popover: "#242220",
      popoverForeground: "#F3EAD0",
      primary: "#FFD600", // yellow stays the accent in dark mode
      primaryForeground: "#0C0C0C",
      secondary: "#242220",
      secondaryForeground: "#F3EAD0",
      muted: "#242220",
      mutedForeground: "#B8AE98",
      accent: "#2E2B27",
      accentForeground: "#F3EAD0",
      destructive: "#F3EAD0",
      destructiveForeground: "#1A1917",
      border: "#3A3530",
      input: "#3A3530",
      ring: "#FFD600",
      radius: "0rem",
    },
    customCss: restormelTheme,
  },
  metadata: {
    title: "Restormel API Reference",
    description:
      "Route model requests with fallback chains and stand up agent-ready knowledge infrastructure — in one signed-in workspace, with direct providers and BYOK custody.",
    favicon: `${RESTORMEL_SITE}/favicon.ico`,
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
        { type: "doc", file: "integrations-mcp" },
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
        // Restormel's developer audience: JS-first, then Python and curl.
        // (Zudoku's snippet generator has no TypeScript target — "js" emits a
        // fetch() example, which is valid TS. Java/C#/PHP are omitted.)
        examplesLanguage: "js",
        supportedLanguages: [
          { value: "js", label: "JavaScript" },
          { value: "python", label: "Python" },
          { value: "shell", label: "cURL" },
        ],
        expandAllTags: true,
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
                const consumerKeyUrl = new URL("/keys/dashboard/api/consumer-key", RESTORMEL_SITE).toString();
                const req = new Request(consumerKeyUrl);
                const signed = context.authentication?.signRequest ? context.authentication.signRequest(req) : req;
                const signedUrl = new URL(signed.url);
                const expectedUrl = new URL(consumerKeyUrl);
                if (signedUrl.origin !== expectedUrl.origin || signedUrl.pathname !== expectedUrl.pathname) {
                  throw new Error("Invalid consumer key endpoint");
                }
                const res = await fetch(consumerKeyUrl, {
                  method: signed.method,
                  headers: signed.headers,
                });
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

