/**
 * GET /keys/v1/records — AUTHED internal governance-records feed (Step 5 — REC-PLAN).
 *
 * Serves the internal-readable governance set (Git-as-CMS) to the allotmentology.tech
 * portal's `/handbook` policy centre. This is the ONLY records endpoint that exposes
 * `internal` records — and only when they are `approved`. `confidential`/`restricted`
 * NEVER reach this route (the gate is {@link isInternalReadable}, not "all records").
 *
 * Auth: a single bearer token compared constant-time to `env.RECORDS_FEED_TOKEN`. Missing
 * token, unconfigured server, or mismatch → 401. No session/DB needed (read-only, repo-sourced).
 *
 * The response shape is a stable contract parsed by the consumer with zod — field names are
 * verbatim and MUST NOT be remapped. Bump CONTRACT_VERSION when response semantics change.
 */
import { json } from "@sveltejs/kit";
import { timingSafeEqual } from "node:crypto";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";
import { getBearerToken } from "$lib/server/bearer";
import { loadInternalRecords, type PublishedRecord } from "$lib/server/records/gate";

/** Bump when response semantics change (field set, gate threshold, body sourcing). */
const CONTRACT_VERSION = "2026-06-18.records.v1";

/**
 * Constant-time bearer check against `RECORDS_FEED_TOKEN`. Returns false (fail-closed) when
 * the env token is unset/empty, the request carries no bearer, or the two differ — including
 * when the lengths differ (timingSafeEqual throws on length mismatch, which we treat as a miss).
 */
function isAuthorized(request: Request): boolean {
  const expected = (env.RECORDS_FEED_TOKEN ?? "").trim();
  if (!expected) return false; // unconfigured server never authorizes
  const presented = getBearerToken(request);
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // length leak is acceptable; avoids timingSafeEqual throw
  return timingSafeEqual(a, b);
}

/** Read a raw front-matter field (string), or undefined if absent/empty. */
function fmField(r: PublishedRecord, key: string): string | undefined {
  const v = r.frontMatter[key];
  if (Array.isArray(v)) return v.length ? v.join(", ") : undefined;
  const s = (v ?? "").trim();
  return s ? s : undefined;
}

/** Read a raw front-matter field that may be a single value or list (verbatim shape preserved). */
function fmStringOrList(r: PublishedRecord, key: string): string | string[] | undefined {
  const v = r.frontMatter[key];
  if (Array.isArray(v)) return v.length ? v : undefined;
  const s = (v ?? "").trim();
  return s ? s : undefined;
}

interface RecordOut {
  id: string;
  title: string;
  class: string;
  classification: string;
  status: string;
  owner?: string;
  effective?: string;
  created?: string;
  "last-reviewed"?: string;
  "review-interval"?: string;
  "approved-by"?: string;
  "approved-on"?: string;
  supersedes?: string | string[];
  related?: string | string[];
  version?: string;
  body?: string;
}

function toOut(r: PublishedRecord): RecordOut {
  const out: RecordOut = {
    id: r.id,
    title: r.title,
    class: r.class,
    classification: r.classification,
    status: r.status,
  };
  if (r.owner) out.owner = r.owner;
  // Map the record's resolved effective date (effective || approved-on || created || git) to `effective`.
  if (r.effectiveDate) out.effective = r.effectiveDate;
  const created = fmField(r, "created");
  if (created) out.created = created;
  const lastReviewed = fmField(r, "last-reviewed");
  if (lastReviewed) out["last-reviewed"] = lastReviewed;
  const reviewInterval = fmField(r, "review-interval");
  if (reviewInterval) out["review-interval"] = reviewInterval;
  const approvedBy = fmField(r, "approved-by");
  if (approvedBy) out["approved-by"] = approvedBy;
  const approvedOn = fmField(r, "approved-on");
  if (approvedOn) out["approved-on"] = approvedOn;
  if (r.supersedes.length) out.supersedes = r.supersedes;
  const related = fmStringOrList(r, "related");
  if (related) out.related = related;
  const version = fmField(r, "version");
  if (version) out.version = version;
  // body: the raw markdown body after the front-matter block (RecordDoc.body). All managed
  // records are markdown (the loader only walks `.md`); omit when empty.
  if (r.body) out.body = r.body;
  return out;
}

export const GET: RequestHandler = async ({ request, url }) => {
  if (!isAuthorized(request)) {
    return json(
      { error: "unauthorized", message: "Bearer token required for the internal records feed" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  // Optional class narrowing. We pass `class` through to the loader, but the gate
  // (isInternalReadable) is applied unconditionally inside loadInternalRecords — no query
  // param can widen the set to confidential/restricted or to non-approved records.
  const classParam = (url.searchParams.get("class") || url.searchParams.get("category") || "").trim() || undefined;

  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const offset = offsetParam != null ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;

  const all = loadInternalRecords(classParam ? { class: classParam } : undefined)
    // Defense in depth: emit only records with non-empty required identity fields.
    .filter((r) => r.id && r.title && r.class && r.classification && r.status)
    .map(toOut);

  const total = all.length;
  const limit =
    limitParam != null ? Math.min(Math.max(0, parseInt(limitParam, 10) || 0), 1000) : total;
  const records = all.slice(offset, offset + limit);

  return json(
    {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      records,
    },
    {
      headers: {
        // Internal, authed feed: never shared-cached. A short private TTL lets the portal's
        // own fetch layer absorb repeat reads within a render without going stale.
        "cache-control": "private, max-age=60",
      },
    },
  );
};
