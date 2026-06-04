/**
 * S3 (and S3-compatible: Cloudflare R2, MinIO, Backblaze) source connector.
 * Credential-based — no OAuth. Endpoint override enables S3-compatible stores.
 */
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import type { SourceConnector, SourceDocRef, FetchedDocument } from "@restormel/connect-core";

export type S3Config = {
  region: string;
  bucket: string;
  prefix?: string;
  endpoint?: string;
  accessKeyId: string;
};

const EXT_MIME: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
  json: "application/json",
  csv: "text/csv",
  xml: "application/xml",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function guessMime(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

function basename(key: string): string {
  return key.split("/").filter(Boolean).pop() ?? key;
}

export function buildS3Connector(config: S3Config, secretAccessKey: string): SourceConnector {
  const client = new S3Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey },
    ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
  });

  return {
    provider: "s3",
    async list(opts) {
      const prefix = [config.prefix, opts?.prefix].filter(Boolean).join("");
      const res = await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucket,
          Prefix: prefix || undefined,
          MaxKeys: 200,
          ContinuationToken: opts?.cursor || undefined,
        }),
      );
      const refs: SourceDocRef[] = [];
      for (const obj of res.Contents ?? []) {
        if (!obj.Key || obj.Key.endsWith("/")) continue;
        refs.push({
          id: obj.Key,
          name: basename(obj.Key),
          mime: guessMime(obj.Key),
          size: obj.Size,
          uri: `s3://${config.bucket}/${obj.Key}`,
        });
      }
      return refs;
    },
    async fetch(ref: SourceDocRef): Promise<FetchedDocument> {
      const res = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: ref.id }));
      const body = res.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
      if (!body?.transformToByteArray) throw new Error("S3 object has no readable body.");
      const bytes = await body.transformToByteArray();
      return {
        bytes,
        mime: res.ContentType || guessMime(ref.id),
        name: ref.name || basename(ref.id),
      };
    },
  };
}
