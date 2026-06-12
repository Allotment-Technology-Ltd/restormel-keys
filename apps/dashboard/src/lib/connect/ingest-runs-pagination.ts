/**
 * Keyset pagination helpers for the runs list (Stage W3.1).
 *
 * Pure functions so the cursor contract (encode/decode + next-page detection) is
 * unit-tested without Neon. The data layer (`listConnectIngestJobsForWorkspace`)
 * already decodes the same `createdAtIso|id` base64url cursor; this is the encode
 * side the BFF GET uses, kept in one place so both halves agree.
 */

/** Minimal row shape needed to build a cursor (createdAt is Unix ms or ISO). */
export type CursorRow = { id: string; createdAt: number | string };

/** Encode the keyset cursor for the last row of a page. */
export function encodeRunsCursor(row: CursorRow): string {
  const iso =
    typeof row.createdAt === "number"
      ? new Date(row.createdAt).toISOString()
      : new Date(row.createdAt).toISOString();
  return Buffer.from(`${iso}|${row.id}`).toString("base64url");
}

export type PagedRuns<T extends CursorRow> = {
  page: T[];
  nextCursor: string | null;
};

/**
 * Given `limit+1` rows fetched from the data layer, return the page of `limit`
 * rows and the next cursor (null when there is no further page). Mirrors the
 * `/connect/v1` ingest handler's detection so the two BFFs behave identically.
 */
export function pageWithCursor<T extends CursorRow>(rows: T[], limit: number): PagedRuns<T> {
  const hasNext = rows.length > limit;
  const page = hasNext ? rows.slice(0, limit) : rows;
  let nextCursor: string | null = null;
  if (hasNext && page.length > 0) {
    nextCursor = encodeRunsCursor(page[page.length - 1]!);
  }
  return { page, nextCursor };
}

/** Honest "showing N of M" label for the runs list footer. */
export function showingLabel(loaded: number, total: number): string {
  return `Showing ${loaded} of ${total} run${total === 1 ? "" : "s"}`;
}
