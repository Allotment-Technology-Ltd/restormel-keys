import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const host = url.host;
  const protocol = url.protocol;
  const sitemapUrl = `${protocol}//${host}/sitemap.xml`;

  // Index public marketing + docs; avoid crawling dashboard/app surfaces.
  const body = [
    "User-agent: *",
    "Allow: /keys$",
    "Allow: /keys/$",
    "Allow: /keys/pricing$",
    "Allow: /keys/pricing/$",
    "Allow: /keys/docs$",
    "Allow: /keys/docs/",
    "Disallow: /keys/dashboard",
    "Disallow: /keys/dashboard/",
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

