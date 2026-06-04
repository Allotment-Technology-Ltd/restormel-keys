/**
 * Domain-agnostic ingestion ports: source connectors, document parsers, and
 * chunkers. Implementations (network/credentialed) live in the host app and are
 * registered against these interfaces — mirroring the GraphStore port pattern.
 */

/** A discoverable document in a source (e.g. an S3 object or Drive file). */
export interface SourceDocRef {
  id: string;
  name: string;
  mime?: string;
  size?: number;
  uri?: string;
}

/** Raw bytes fetched from a source, ready for parsing. */
export interface FetchedDocument {
  bytes: Uint8Array;
  mime: string;
  name: string;
}

/** Pulls documents from a backing source (upload, URL, S3, Drive, SharePoint). */
export interface SourceConnector {
  readonly provider: "upload" | "url" | "s3" | "google_drive" | "sharepoint";
  /** List documents available under an optional prefix/cursor. */
  list?(opts?: { prefix?: string; cursor?: string }): Promise<SourceDocRef[]>;
  /** Fetch raw bytes for a document. */
  fetch(ref: SourceDocRef): Promise<FetchedDocument>;
}

/** A typed structural element from a parsed document (Unstructured-style). */
export interface ParsedElement {
  type: "title" | "heading" | "narrative" | "list_item" | "table" | "code" | "other";
  text: string;
  meta?: Record<string, unknown>;
}

export interface ParsedDocument {
  /** Clean markdown representation (layout-aware where the parser supports it). */
  markdown: string;
  /** Optional typed elements for structure-aware chunking. */
  elements?: ParsedElement[];
}

/** Converts raw document bytes of any format into normalized markdown + elements. */
export interface DocumentParser {
  readonly id: "builtin" | "llamaparse" | "unstructured";
  /** True if this parser can handle the given mime type. */
  supports(mime: string): boolean;
  parse(input: FetchedDocument): Promise<ParsedDocument>;
}

/** A chunk of a document that preserves a complete unit where possible. */
export interface DocChunk {
  index: number;
  text: string;
  meta?: Record<string, unknown>;
}

/** Injected embedding function: map texts to vectors (host provides the provider). */
export type EmbeddingPort = (texts: string[]) => Promise<number[][]>;
