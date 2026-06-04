/**
 * Microsoft Graph source connector for SharePoint/OneDrive (REST via fetch,
 * bound to an access token).
 */
import type { SourceConnector, SourceDocRef, FetchedDocument } from "@restormel/connect-core";

type GraphItem = {
  id: string;
  name: string;
  size?: number;
  file?: { mimeType?: string };
  folder?: unknown;
};

export function buildMicrosoftConnector(accessToken: string): SourceConnector {
  const auth = { Authorization: `Bearer ${accessToken}` };
  return {
    provider: "sharepoint",
    async list(opts) {
      // Browse a folder by path/cursor, default the drive root.
      const path = opts?.prefix ? `root:/${opts.prefix.replace(/^\/+/, "")}:/children` : "root/children";
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/${path}?$top=100`, { headers: auth });
      if (!res.ok) throw new Error(`Graph list failed (HTTP ${res.status}).`);
      const data = (await res.json()) as { value?: GraphItem[] };
      return (data.value ?? [])
        .filter((it) => !it.folder)
        .map((it) => ({
          id: it.id,
          name: it.name,
          mime: it.file?.mimeType,
          size: it.size,
          uri: `msgraph://${it.id}`,
        }));
    },
    async fetch(ref: SourceDocRef): Promise<FetchedDocument> {
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(ref.id)}/content`, {
        headers: auth,
      });
      if (!res.ok) throw new Error(`Graph download failed (HTTP ${res.status}).`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const mime = ref.mime ?? res.headers.get("content-type") ?? "application/octet-stream";
      return { bytes, mime, name: ref.name };
    },
  };
}
