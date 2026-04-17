import type { RequestHandler } from "./$types";

const STATIC_PATHS = [
  "/",
  "/keys",
  "/keys/pricing",
  "/keys/use-cases",
  "/keys/privacy",
  "/keys/terms",
  "/keys/refund-policy",
  "/keys/docs",
  "/keys/docs/walkthrough",
  "/keys/docs/walkthrough/phase-0-inventory",
  "/keys/docs/walkthrough/phase-1-install",
  "/keys/docs/walkthrough/phase-2-resolve",
  "/keys/docs/walkthrough/phase-3-routes",
  "/keys/docs/walkthrough/phase-4-policies",
  "/keys/docs/walkthrough/phase-5-ui",
  "/keys/docs/walkthrough/phase-6-golive",
  "/keys/docs/walkthrough/migration-paths",
  "/keys/docs/walkthrough/verification-strategy",
  "/keys/docs/walkthrough/staging-and-ci-setup",
  "/keys/docs/guides/environment-vocabulary",
  "/keys/docs/guides/keys-testing-onboarding",
  "/keys/docs/guides/provider-access-modes",
  "/keys/docs/guides/openrouter",
  "/keys/docs/guides/aizolo",
  "/keys/docs/guides/portkey",
  "/keys/docs/guides/vercel-ai-gateway",
  "/keys/docs/guides/integration-vs-hosted-vault",
  "/keys/docs/guides/canonical-catalog",
  "/keys/docs/guides/integration-catalog",
  "/keys/docs/guides/third-party-brand-marks",
  "/keys/docs/compatibility",
  "/keys/docs/cloud-api",
  "/keys/docs/reference/cli",
];

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

export const GET: RequestHandler = async ({ url }) => {
  const base = `${url.protocol}//${url.host}`;
  const now = new Date().toISOString();

  const urls = STATIC_PATHS.map((p) => {
    const loc = xmlEscape(base + p);
    return [
      "  <url>",
      `    <loc>${loc}</loc>`,
      `    <lastmod>${now}</lastmod>`,
      "  </url>",
    ].join("\n");
  }).join("\n");

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};

