import { formatSourceProvenancePreview, type SourceMetadata } from "@restormel/connect-core";
import { ConnectSourceProvenanceSchema, type ConnectSourceProvenance } from "@restormel/contracts/connect";

export function parseStoredProvenance(raw: unknown): ConnectSourceProvenance | undefined {
  const parsed = ConnectSourceProvenanceSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export function provenanceToSourceMetadata(prov: ConnectSourceProvenance): SourceMetadata {
  return {
    title: prov.title ?? null,
    canonical_url: prov.canonical_url ?? null,
    url: prov.url ?? null,
    authors: prov.authors ?? [],
    description: prov.description ?? null,
    site_name: prov.site_name ?? null,
    published_at: prov.published_at ?? null,
  };
}

export function provenancePreviewText(prov: ConnectSourceProvenance | undefined): string | null {
  if (!prov) return null;
  return formatSourceProvenancePreview(provenanceToSourceMetadata(prov));
}

export function resolveDocumentDisplayName(params: {
  fallbackName: string;
  provenance?: ConnectSourceProvenance;
  explicitName?: string | null;
}): string {
  const explicit = params.explicitName?.trim();
  if (explicit) return explicit.slice(0, 500);
  const fromProv = params.provenance?.title?.trim();
  if (fromProv) return fromProv.slice(0, 500);
  return params.fallbackName.slice(0, 500);
}
