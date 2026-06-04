import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getSuggestedGraphDesignerIntent,
  isStarterCorpusDocumentName,
  STARTER_CORPUS_MANIFEST_ID,
} from "./starter-corpus";
import { STARTER_CORPUS_NAME_PREFIX } from "$lib/connect/first-graph-guide";

const CORPUS_DIR = join(dirname(fileURLToPath(import.meta.url)), "starter-corpus");

describe("starter-corpus", () => {
  it("uses Starter: name prefix for identification", () => {
    expect(isStarterCorpusDocumentName("Starter: Trolley")).toBe(true);
    expect(isStarterCorpusDocumentName("My doc")).toBe(false);
    expect(STARTER_CORPUS_NAME_PREFIX).toBe("Starter:");
  });

  it("manifest lists three demo documents", () => {
    const manifest = JSON.parse(readFileSync(join(CORPUS_DIR, "manifest.json"), "utf8")) as {
      id: string;
      documents: { file: string; name: string }[];
    };
    expect(manifest.id).toBe(STARTER_CORPUS_MANIFEST_ID);
    expect(manifest.documents).toHaveLength(3);
    for (const doc of manifest.documents) {
      const text = readFileSync(join(CORPUS_DIR, doc.file), "utf8");
      expect(text.length).toBeGreaterThan(200);
      expect(doc.name.startsWith(STARTER_CORPUS_NAME_PREFIX)).toBe(true);
    }
  });

  it("provides suggested Graph Designer intent", () => {
    expect(getSuggestedGraphDesignerIntent()).toMatch(/philosophical claims/i);
    expect(getSuggestedGraphDesignerIntent().length).toBeGreaterThan(40);
  });
});
