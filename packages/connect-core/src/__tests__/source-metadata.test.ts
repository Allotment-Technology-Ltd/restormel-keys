import { describe, expect, it } from "vitest";
import { extractSourceMetadataFromHtml, formatSourceProvenancePreview } from "../ingest/source-metadata.js";

describe("extractSourceMetadataFromHtml", () => {
  it("reads og and canonical metadata", () => {
    const html = `<!DOCTYPE html><html><head>
      <title>Page title</title>
      <meta property="og:title" content="OG Title" />
      <meta name="author" content="Ada Lovelace, Charles Babbage" />
      <meta property="og:description" content="A short summary." />
      <meta property="og:site_name" content="SEP" />
      <link rel="canonical" href="/entries/existentialism/" />
    </head><body><h1>Body h1</h1></body></html>`;
    const meta = extractSourceMetadataFromHtml(
      html,
      "https://plato.stanford.edu/entries/existentialism/",
    );
    expect(meta.title).toBe("OG Title");
    expect(meta.canonical_url).toBe("https://plato.stanford.edu/entries/existentialism/");
    expect(meta.authors).toEqual(["Ada Lovelace", "Charles Babbage"]);
    expect(meta.description).toBe("A short summary.");
    expect(meta.site_name).toBe("SEP");
    expect(formatSourceProvenancePreview(meta)).toContain("Ada Lovelace");
  });
});
