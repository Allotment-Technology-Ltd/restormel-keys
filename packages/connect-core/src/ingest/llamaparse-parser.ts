/**
 * LlamaParse BYOK adapter — calls LlamaCloud parse API when LLAMAPARSE_API_KEY is set.
 */
import type { DocumentParser, FetchedDocument, ParsedDocument } from "./ingest-ports.js";

const LLAMAPARSE_API = "https://api.cloud.llamaindex.ai/api/parsing/upload";

export class LlamaParseDocumentParser implements DocumentParser {
  readonly id = "llamaparse" as const;

  constructor(private readonly apiKey: string) {}

  supports(mime: string): boolean {
    const m = mime.toLowerCase();
    return m.includes("pdf") || m.includes("word") || m.includes("presentation") || m.includes("text");
  }

  async parse(input: FetchedDocument): Promise<ParsedDocument> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([Buffer.from(input.bytes)], { type: input.mime }),
      input.name,
    );
    const res = await fetch(LLAMAPARSE_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`LlamaParse failed (HTTP ${res.status}). ${detail.slice(0, 200)}`.trim());
    }
    const data = (await res.json()) as { markdown?: string; text?: string };
    const markdown = data.markdown ?? data.text ?? "";
    if (!markdown.trim()) {
      throw new Error("LlamaParse returned empty content.");
    }
    return { markdown: markdown.trim() };
  }
}

export function createLlamaParseParser(apiKey: string): DocumentParser {
  return new LlamaParseDocumentParser(apiKey);
}
