import type { ZudokuConfig } from "zudoku";
// Neo-brutalist portal styling lives in a real CSS file and is injected via
// theme.customCss below. See restormel-theme.css for selector confidence notes.
import restormelTheme from "./restormel-theme.css?raw";

/** Product site (Keys, Docs, Dashboard). */
const RESTORMEL_SITE = (
  process.env.ZUDOKU_PUBLIC_RESTORMEL_SITE_ORIGIN ?? "https://restormel.dev"
).replace(/\/$/, "");

// ─────────────────────────────────────────────────────────────────────────────
// This Zuplo dev portal is intentionally a MINIMAL REDIRECT STUB.
//
// The canonical, unified Restormel documentation — including the full API
// reference, rendered with Scalar from the same OpenAPI spec (config/routes.oas.json)
// — now lives at ${RESTORMEL_SITE}/keys/docs. Zuplo requires a passing dev-portal
// build to deploy the gateway, but its build sandbox OOMs on the full zudoku
// OpenAPI render (see zuplo-gateway/docs/scripts/apply-zudoku-ui-patches.mjs and
// the Zuplo support thread). Keeping this portal tiny (no `apis` block, one page)
// lets the gateway deploy succeed while we serve real docs from infra we control.
// ─────────────────────────────────────────────────────────────────────────────
const config: ZudokuConfig = {
  site: {
    title: "Restormel API",
    logo: {
      src: { light: `${RESTORMEL_SITE}/restormel-lockup-nav.svg`, dark: `${RESTORMEL_SITE}/restormel-lockup-nav.svg` },
      href: `${RESTORMEL_SITE}/keys`,
      alt: "Restormel",
      width: "134px",
    },
  },
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
      background: "#F3EAD0",
      foreground: "#0C0C0C",
      card: "#FFFEF0",
      cardForeground: "#0C0C0C",
      popover: "#FFFEF0",
      popoverForeground: "#0C0C0C",
      primary: "#FFD600",
      primaryForeground: "#0C0C0C",
      secondary: "#E8DFBF",
      secondaryForeground: "#0C0C0C",
      muted: "#E8DFBF",
      mutedForeground: "#3A3530",
      accent: "#E8DFBF",
      accentForeground: "#0C0C0C",
      destructive: "#0C0C0C",
      destructiveForeground: "#FFFEF0",
      border: "#0C0C0C",
      input: "#0C0C0C",
      ring: "#FFD600",
      radius: "0rem",
    },
    dark: {
      background: "#1A1917",
      foreground: "#F3EAD0",
      card: "#242220",
      cardForeground: "#F3EAD0",
      popover: "#242220",
      popoverForeground: "#F3EAD0",
      primary: "#FFD600",
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
    title: "Restormel API",
    description:
      "The Restormel API reference and documentation now live at restormel.dev/keys/docs.",
    favicon: `${RESTORMEL_SITE}/favicon.ico`,
  },
  navigation: [
    {
      type: "category",
      label: "Restormel documentation",
      items: [
        { type: "doc", file: "introduction" },
        {
          type: "link",
          label: "API reference",
          to: `${RESTORMEL_SITE}/keys/docs/api-reference`,
          target: "_self",
          icon: "book-open",
        },
        {
          type: "link",
          label: "Documentation home",
          to: `${RESTORMEL_SITE}/keys/docs`,
          target: "_self",
          icon: "book",
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
  ],
  redirects: [{ from: "/", to: "/introduction" }],
  docs: {
    files: "./pages/introduction.md",
  },
};

export default config;
