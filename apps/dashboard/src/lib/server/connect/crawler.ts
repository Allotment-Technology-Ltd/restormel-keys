/**
 * Website / sitemap crawler: discover page URLs from a root (sitemap or in-page
 * links), then fetch + parse each into the normalized source-documents store.
 * URL discovery lives in @restormel/connect-core (pure, tested); this adds the
 * bounded network loop.
 */
import { extractLinks, parseSitemapUrls, sitemapUrlFor } from "@restormel/connect-core";
import type { ConnectCrawlRequest, ConnectSourceDocument } from "@restormel/contracts/connect";
import { addSourceDocument } from "$lib/server/connect/source-documents";

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function crawlAndImport(args: {
  workspaceId: string;
  request: ConnectCrawlRequest;
}): Promise<{ discovered: number; documents: ConnectSourceDocument[] }> {
  const { request } = args;
  const max = request.max_pages;
  const urls = new Set<string>([request.root_url]);

  if (request.use_sitemap) {
    const sitemapUrl = sitemapUrlFor(request.root_url);
    if (sitemapUrl) {
      const xml = await fetchText(sitemapUrl);
      if (xml) for (const u of parseSitemapUrls(xml)) urls.add(u);
    }
  }

  if (urls.size < max) {
    const rootHtml = await fetchText(request.root_url);
    if (rootHtml) {
      for (const link of extractLinks(rootHtml, request.root_url, { sameHostOnly: request.same_host_only })) {
        urls.add(link);
        if (urls.size >= max) break;
      }
    }
  }

  const list = [...urls].slice(0, max);
  const documents: ConnectSourceDocument[] = [];
  for (const url of list) {
    const doc = await addSourceDocument(args.workspaceId, { kind: "url", url, content_encoding: "utf8" });
    documents.push(doc);
  }
  return { discovered: urls.size, documents };
}
