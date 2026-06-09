import { describe, expect, it } from "vitest";
import { chunkDocument } from "../ingest/chunking.js";
import { builtinDocumentParser, BuiltinParseUnsupportedError } from "../ingest/builtin-parser.js";

const profile = { strategy: "structure_aware" as const, min_chars: 50, max_chars: 200, overlap_chars: 0 };

describe("chunkDocument", () => {
  it("returns no chunks for empty input", () => {
    expect(chunkDocument("", profile)).toEqual([]);
  });

  it("keeps a small document as a single chunk (complete unit)", () => {
    const chunks = chunkDocument("A short paragraph that stays whole.", profile);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
  });

  it("packs paragraphs and never exceeds max_chars", () => {
    const para = "Lorem ipsum dolor sit amet. ".repeat(6).trim();
    const md = [para, para, para, para].join("\n\n");
    const chunks = chunkDocument(md, profile);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(profile.max_chars);
  });

  it("hard-splits an oversized single block", () => {
    const huge = "word ".repeat(200).trim();
    const chunks = chunkDocument(huge, profile);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(profile.max_chars);
  });

  it("fixed strategy slices by size", () => {
    const text = "x".repeat(500);
    const chunks = chunkDocument(text, { strategy: "fixed", min_chars: 50, max_chars: 100, overlap_chars: 0 });
    expect(chunks.length).toBe(5);
  });

  it("structure_aware carries overlap_chars across chunk boundaries", () => {
    const doc =
      "Paragraph A. Bentham holds that pleasure is the only intrinsic good. " +
      "This hedonistic axiom is the foundation of his entire system.\n\n" +
      "Paragraph B. Nozick's experience-machine argument refutes that axiom directly, " +
      "showing we value more than felt pleasure.";
    const chunks = chunkDocument(doc, {
      strategy: "structure_aware",
      min_chars: 40,
      max_chars: 160,
      overlap_chars: 40,
    });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < chunks.length; i++) {
      const head = chunks[i].text.split("\n\n")[0];
      expect(head.length).toBeGreaterThan(0);
      expect(head.length).toBeLessThanOrEqual(40);
      expect(chunks[i - 1].text.endsWith(head)).toBe(true);
    }
  });

  it("structure_aware with overlap_chars 0 is unchanged", () => {
    const para = "Lorem ipsum dolor sit amet. ".repeat(6).trim();
    const md = [para, para, para].join("\n\n");
    expect(chunkDocument(md, profile)).toEqual(chunkDocument(md, { ...profile, overlap_chars: 0 }));
    for (const c of chunkDocument(md, profile)) {
      expect(c.text.length).toBeLessThanOrEqual(profile.max_chars);
    }
  });
});

describe("builtinDocumentParser", () => {
  const enc = (s: string) => new TextEncoder().encode(s);

  it("parses markdown into elements", async () => {
    const out = await builtinDocumentParser.parse({
      bytes: enc("# Title\n\nA paragraph.\n\n- item one"),
      mime: "text/markdown",
      name: "doc.md",
    });
    expect(out.markdown).toContain("Title");
    expect(out.elements?.[0]).toEqual({ type: "heading", text: "Title", meta: { level: 1 } });
    expect(out.elements?.some((e) => e.type === "list_item")).toBe(true);
  });

  it("strips HTML to readable markdown", async () => {
    const out = await builtinDocumentParser.parse({
      bytes: enc("<html><body><h2>Heading</h2><p>Body text.</p></body></html>"),
      mime: "text/html",
      name: "page.html",
    });
    expect(out.markdown).toContain("## Heading");
    expect(out.markdown).toContain("Body text.");
  });

  it("rejects binary formats with a clear error", async () => {
    await expect(
      builtinDocumentParser.parse({ bytes: enc("%PDF-1.7"), mime: "application/pdf", name: "x.pdf" }),
    ).rejects.toBeInstanceOf(BuiltinParseUnsupportedError);
  });
});
