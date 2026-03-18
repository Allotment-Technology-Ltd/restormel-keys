import type { ZudokuConfig } from "zudoku";
import { createApiIdentityPlugin } from "zudoku/plugins";

const config: ZudokuConfig = {
  site: { title: "Restormel Keys" },
  navigation: [
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
    },
  ],
  docs: {
    files: "./pages/**/*.{md,mdx}",
  },
  authentication: {
    type: "openid",
    clientId: process.env.RESTORMEL_OIDC_CLIENT_ID ?? "",
    issuer: "https://restormel.dev/keys/auth",
    scopes: ["openid", "profile", "email"],
  },
  protectedRoutes: ["/api/*", "/my-keys"],
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

