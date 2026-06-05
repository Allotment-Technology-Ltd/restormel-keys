/**
 * Unstructured.io BYOK adapter — partition API when UNSTRUCTURED_API_KEY is set.
 */
import type { DocumentParser, FetchedDocument, ParsedDocument, ParsedElement } from "./ingest-ports.js";

const UNSTRUCTURED_API = "https://api.unstructured.io/general/v0/general";

export class UnstructuredDocumentParser implements DocumentParser {
  readonly id = "unstructured" as const;

  constructor(private readonly apiKey: string) {}

  supports(mime: string): boolean {
    const m = mime.toLowerCase();
    return (
      m.includes("pdf") ||
      m.includes("word") ||
      m.includes("html") ||
      m.includes("text") ||
      m.includes("presentation")
    );
  }

  async parse(input: FetchedDocument): Promise<ParsedDocument> {
    const form = new FormData();
    form.append(
      "files",
      new Blob([Buffer.from(input.bytes)], { type: input.mime }),
      input.name,
    );
    form.append("strategy", "hi_res");
    const res = await fetch(UNSTRUCTURED_API, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "unstructured-api-key": this.apiKey,
      },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Unstructured failed (HTTP ${res.status}). ${detail.slice(0, 200)}`.trim());
    }
    const blocks = (await res.json()) as { type?: string; text?: string }[];
    const elements: ParsedElement[] = [];
    const lines: string[] = [];
    for (const block of blocks) {
      const text = block.text?.trim();
      if (!text) continue;
      lines.push(text);
      const t = (block.type ?? "other").toLowerCase();
      const type: ParsedElement["type"] =
        t.includes("title") ? "title" :
        t.includes("header") ? "heading" :
        t.includes("list") ? "list_item" :
        t.includes("table") ? "table" :
        "narrative";
      elements.push({ type, text });
    }
    return {
      markdown: lines.join("\n\n"),
      elements,
    };
  }
}

export function createUnstructuredParser(apiKey: string): DocumentParser {
  return new UnstructuredDocumentParser(apiKey);
}
