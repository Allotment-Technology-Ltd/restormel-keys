/** Every graph unit written during ingest must reference a registered source record. */
export const GRAPH_UNIT_SOURCE_REQUIRED =
  "Graph units require a registered ingest source — register the source before persisting ideas.";

export function requireGraphUnitSourceId(sourceId: string | null | undefined): string {
  const id = sourceId?.trim();
  if (!id) {
    throw new Error(GRAPH_UNIT_SOURCE_REQUIRED);
  }
  return id;
}
