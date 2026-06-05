/**
 * Optional entity linking queue (philosophy / Wikidata pattern).
 * When pack.entity_linking.enabled, post-ingest jobs can enqueue linker work.
 * Full resolver wiring is M4 — this records intent for operators.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";

export type EntityLinkingQueueItem = {
  unitId: string;
  label: string;
  domain?: string;
};

export function entityLinkingEnabled(pack: ConnectDomainPack | null | undefined): boolean {
  return Boolean(pack?.entity_linking?.enabled);
}

/** Placeholder queue builder — returns candidates when linking is enabled. */
export function buildEntityLinkingQueue(
  pack: ConnectDomainPack,
  units: { id: string; text: string; domain?: string | null }[],
): EntityLinkingQueueItem[] {
  if (!entityLinkingEnabled(pack)) return [];
  return units.slice(0, 50).map((u) => ({
    unitId: u.id,
    label: u.text.slice(0, 120),
    ...(u.domain ? { domain: u.domain } : {}),
  }));
}
