import { describe, expect, it } from "vitest";
import {
  coerceScalarField,
  extractSourceKind,
  extractSourceTitle,
  extractSourceUrl,
  normalizeAuthor,
} from "./source-field-extract";

describe("source-field-extract — owner's exact schema", () => {
  // Table `source`; URL under `canonical_url`, kind under `source_type`, author is an array.
  const ownerRow = {
    id: "source:1",
    title: "T",
    canonical_url: "https://x",
    source_type: "paper",
    author: ["A. Smith", "B. Jones"],
  };

  it("resolves canonical_url as the URL", () => {
    expect(extractSourceUrl(ownerRow)).toBe("https://x");
  });

  it("resolves source_type as the kind", () => {
    expect(extractSourceKind(ownerRow)).toBe("paper");
  });

  it("resolves the title", () => {
    expect(extractSourceTitle(ownerRow)).toBe("T");
  });

  it("joins the author array with a comma", () => {
    expect(normalizeAuthor(ownerRow.author)).toBe("A. Smith, B. Jones");
  });
});

describe("extractSourceUrl", () => {
  it("prefers url, then canonical_url, then synonyms", () => {
    expect(extractSourceUrl({ url: "https://a" })).toBe("https://a");
    expect(extractSourceUrl({ source_url: "https://b" })).toBe("https://b");
    expect(extractSourceUrl({ link: "https://c" })).toBe("https://c");
    expect(extractSourceUrl({ href: "https://d" })).toBe("https://d");
    expect(extractSourceUrl({ permalink: "https://e" })).toBe("https://e");
  });

  it("trims and ignores empty / non-string values", () => {
    expect(extractSourceUrl({ canonical_url: "  https://trim  " })).toBe("https://trim");
    expect(extractSourceUrl({ url: "   " })).toBeNull();
    expect(extractSourceUrl({ url: 42 })).toBeNull();
    expect(extractSourceUrl(null)).toBeNull();
    expect(extractSourceUrl({})).toBeNull();
  });
});

describe("extractSourceKind", () => {
  it("resolves across kind synonyms", () => {
    expect(extractSourceKind({ kind: "book" })).toBe("book");
    expect(extractSourceKind({ source_kind: "report" })).toBe("report");
    expect(extractSourceKind({ source_type: "paper" })).toBe("paper");
    expect(extractSourceKind({ type: "web" })).toBe("web");
    expect(extractSourceKind({ doc_type: "pdf" })).toBe("pdf");
  });

  it("returns null when no kind field is present", () => {
    expect(extractSourceKind({ title: "x" })).toBeNull();
  });
});

describe("extractSourceTitle", () => {
  it("resolves across title synonyms", () => {
    expect(extractSourceTitle({ title: "T" })).toBe("T");
    expect(extractSourceTitle({ name: "N" })).toBe("N");
    expect(extractSourceTitle({ headline: "H" })).toBe("H");
    expect(extractSourceTitle({ label: "L" })).toBe("L");
  });

  it("returns null when no title field is present", () => {
    expect(extractSourceTitle({ canonical_url: "https://x" })).toBeNull();
  });
});

describe("normalizeAuthor", () => {
  it("handles a scalar string author", () => {
    expect(normalizeAuthor("A. Smith")).toBe("A. Smith");
    expect(normalizeAuthor("  trimmed  ")).toBe("trimmed");
  });

  it("joins a string[] author", () => {
    expect(normalizeAuthor(["A. Smith", "B. Jones"])).toBe("A. Smith, B. Jones");
  });

  it("maps an array of objects with name/full_name/label", () => {
    expect(
      normalizeAuthor([{ name: "A. Smith" }, { full_name: "B. Jones" }, { label: "C. Lee" }]),
    ).toBe("A. Smith, B. Jones, C. Lee");
  });

  it("returns null for missing / empty / unusable values", () => {
    expect(normalizeAuthor(null)).toBeNull();
    expect(normalizeAuthor(undefined)).toBeNull();
    expect(normalizeAuthor([])).toBeNull();
    expect(normalizeAuthor([{}, { other: "x" }])).toBeNull();
    expect(normalizeAuthor("   ")).toBeNull();
  });

  it("never throws on arrays/objects", () => {
    expect(() => normalizeAuthor([1, 2, 3])).not.toThrow();
    expect(() => normalizeAuthor({ deeply: { nested: true } })).not.toThrow();
  });
});

describe("coerceScalarField", () => {
  it("coerces a string", () => {
    expect(coerceScalarField("hello")).toBe("hello");
    expect(coerceScalarField("  trim ")).toBe("trim");
  });

  it("coerces a number", () => {
    expect(coerceScalarField(2026)).toBe("2026");
  });

  it("coerces a string[] by joining", () => {
    expect(coerceScalarField(["a", "b"])).toBe("a, b");
  });

  it("coerces an object with a name", () => {
    expect(coerceScalarField({ name: "Named" })).toBe("Named");
  });

  it("returns null for null/undefined/empty", () => {
    expect(coerceScalarField(null)).toBeNull();
    expect(coerceScalarField(undefined)).toBeNull();
    expect(coerceScalarField("")).toBeNull();
    expect(coerceScalarField({})).toBeNull();
  });

  it("never throws", () => {
    expect(() => coerceScalarField([{ a: 1 }, null, "x"])).not.toThrow();
  });
});
