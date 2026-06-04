/**
 * Built-in, dependency-free document parser (OSS default). Handles text-like
 * formats: plain text, markdown, HTML, JSON, CSV. Binary formats (PDF, DOCX, …)
 * are intentionally NOT handled here — configure a managed parser
 * (LlamaParse/Unstructured) for those. The parser interface is pluggable so
 * upgrading is a config change, not a pipeline rewrite.
 */
import type { DocumentParser, FetchedDocument, ParsedDocument, ParsedElement } from "./ingest-ports.js";

const TEXT_MIME = /^(text\/|application\/(json|xml|x-ndjson|csv)|application\/xhtml\+xml)/i;

export class BuiltinParseUnsupportedError extends Error {}

function decode(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

/** Strip HTML to readable text while keeping heading/paragraph structure. */
function htmlToMarkdown(html: string): string {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lvl: string, inner: string) => {
    const hashes = "#".repeat(Number(lvl));
    return `\n\n${hashes} ${stripTags(inner).trim()}\n\n`;
  });
  s = s.replace(/<\/(p|div|section|article|li|tr|h[1-6])>/gi, "\n\n");
  s = s.replace(/<li[^>]*>/gi, "- ");
  s = s.replace(/<br\s*\/?>(?!\n)/gi, "\n");
  s = stripTags(s);
  s = decodeEntities(s);
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function elementsFromMarkdown(markdown: string): ParsedElement[] {
  const elements: ParsedElement[] = [];
  for (const raw of markdown.split(/\n{2,}/)) {
    const block = raw.trim();
    if (!block) continue;
    const heading = block.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      elements.push({ type: "heading", text: heading[2].trim(), meta: { level: heading[1].length } });
    } else if (/^[-*]\s+/.test(block)) {
      elements.push({ type: "list_item", text: block.replace(/^[-*]\s+/, "").trim() });
    } else {
      elements.push({ type: "narrative", text: block });
    }
  }
  return elements;
}

export class BuiltinDocumentParser implements DocumentParser {
  readonly id = "builtin" as const;

  supports(mime: string): boolean {
    return TEXT_MIME.test(mime ?? "");
  }

  async parse(input: FetchedDocument): Promise<ParsedDocument> {
    const mime = (input.mime ?? "").toLowerCase();
    if (!this.supports(mime) && mime) {
      throw new BuiltinParseUnsupportedError(
        `Built-in parser cannot read "${mime}". Configure a managed parser (LlamaParse/Unstructured) for this format.`,
      );
    }
    const text = decode(input.bytes);
    const markdown = mime.includes("html") || /<html[\s>]/i.test(text) ? htmlToMarkdown(text) : text.trim();
    return { markdown, elements: elementsFromMarkdown(markdown) };
  }
}

export const builtinDocumentParser = new BuiltinDocumentParser();
