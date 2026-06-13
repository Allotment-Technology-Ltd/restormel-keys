import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const host = url.host;
  const protocol = url.protocol;
  const sitemapUrl = `${protocol}//${host}/sitemap.xml`;

  // Index all public marketing + docs surfaces; disallow app/dashboard/admin/API surfaces.
  const body = [
    "User-agent: *",
    // Disallow authenticated/app surfaces first (more-specific paths win in most crawlers)
    "Disallow: /keys/dashboard",
    "Disallow: /keys/dashboard/",
    "Disallow: /keys/admin",
    "Disallow: /keys/admin/",
    "Disallow: /keys/auth",
    "Disallow: /keys/auth/",
    "Disallow: /keys/v1",
    "Disallow: /keys/v1/",
    "Disallow: /api",
    "Disallow: /api/",
    "Disallow: /v1",
    "Disallow: /v1/",
    "Disallow: /founders/pending",
    // Allow public marketing + docs surfaces
    "Allow: /",
    `Sitemap: ${sitemapUrl}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};

