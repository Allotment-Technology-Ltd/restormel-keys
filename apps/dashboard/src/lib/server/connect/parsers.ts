/**
 * Pluggable document-parser registry. Built-in (OSS, dependency-free) is the
 * default and handles text-like formats. Managed providers (LlamaParse,
 * Unstructured) are opt-in and env-gated — selecting one without configuration
 * yields a clear error rather than silent failure. Swapping providers is a
 * config change, not a pipeline rewrite.
 */
import { builtinDocumentParser, type DocumentParser, type FetchedDocument, type ParsedDocument } from "@restormel/connect-core";

export type ParserProvider = "builtin" | "llamaparse" | "unstructured";

class ManagedParserNotConfigured implements DocumentParser {
  constructor(public readonly id: "llamaparse" | "unstructured", private readonly envVar: string) {}
  supports(): boolean {
    return false;
  }
  async parse(_input: FetchedDocument): Promise<ParsedDocument> {
    throw new Error(
      `Managed parser "${this.id}" is selected but not configured. Set ${this.envVar} to enable it, or use the built-in parser for text formats.`,
    );
  }
}

/** Resolve a parser for the requested provider, falling back to built-in. */
export function pickParser(provider: ParserProvider = "builtin"): DocumentParser {
  if (provider === "llamaparse") {
    if (process.env.LLAMAPARSE_API_KEY?.trim()) {
      // Managed adapter wiring lands when enabled; until then, fall back to builtin for text.
      return builtinDocumentParser;
    }
    return new ManagedParserNotConfigured("llamaparse", "LLAMAPARSE_API_KEY");
  }
  if (provider === "unstructured") {
    if (process.env.UNSTRUCTURED_API_KEY?.trim()) {
      return builtinDocumentParser;
    }
    return new ManagedParserNotConfigured("unstructured", "UNSTRUCTURED_API_KEY");
  }
  return builtinDocumentParser;
}
