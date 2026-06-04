import { describe, expect, it } from "vitest";
import { extractLinks, parseSitemapUrls, sitemapUrlFor } from "../ingest/crawl.js";

describe("extractLinks", () => {
  const html = `
    <a href="/docs/a">A</a>
    <a href='https://example.com/docs/b'>B</a>
    <a href="https://other.com/x">external</a>
    <a href="#section">anchor</a>
    <a href="mailto:hi@example.com">mail</a>
    <a href="https://example.com/docs/a">dup</a>
  `;
  it("resolves relative links and keeps same-host by default", () => {
    const links = extractLinks(html, "https://example.com/docs/");
    expect(links).toContain("https://example.com/docs/a");
    expect(links).toContain("https://example.com/docs/b");
    expect(links).not.toContain("https://other.com/x");
    expect(links.filter((l) => l.endsWith("/docs/a"))).toHaveLength(1); // deduped
    expect(links.some((l) => l.includes("mailto"))).toBe(false);
  });
  it("includes external hosts when sameHostOnly is false", () => {
    const links = extractLinks(html, "https://example.com/docs/", { sameHostOnly: false });
    expect(links).toContain("https://other.com/x");
  });
});

describe("parseSitemapUrls", () => {
  it("extracts loc entries", () => {
    const xml = `<urlset><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/b</loc></url></urlset>`;
    expect(parseSitemapUrls(xml)).toEqual(["https://example.com/a", "https://example.com/b"]);
  });
});

describe("sitemapUrlFor", () => {
  it("derives sitemap url from a root", () => {
    expect(sitemapUrlFor("https://example.com/docs/x")).toBe("https://example.com/sitemap.xml");
    expect(sitemapUrlFor("not a url")).toBeNull();
  });
});
