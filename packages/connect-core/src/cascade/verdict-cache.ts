/**
 * Hash-keyed EXACT-MATCH verdict cache (REC-PLAN-023 sec-b; restormel-verification-engineering
 * sec-6 "verdict-cache discipline"). Built FIRST -- it is the cheapest cost lever (the task
 * brief and REC-PLAN-023 both say build the cache before the cascade).
 *
 * EXACT-MATCH ONLY. There is no approximate/fuzzy/nearest-neighbour lookup anywhere in this
 * file -- a near-miss hit would silently flip a verdict, the exact failure the product exists
 * to prevent (skill sec-6, and the resolved approximate-caching conflict). The grep gate
 * `grep -rinE 'similar|embed|cosine' cascade/verdict-cache.ts` must return zero hits, so this
 * file avoids those trigger words even in prose.
 *
 * Key composition (every field mandatory -- omitting one is a Blocker, skill sec-6):
 *   hash(canonicalSerialize({
 *     claimTextCanonical, sourceSpan, sourceVersionHash,
 *     checkerId, checkerModelVersion, checkerConfigHash, promptTemplateVersion
 *   }))
 * REC-PLAN-023's four fields (claim + span + source-version-hash + checker-version) read
 * WIDE per the skill's resolution: "checker-version" expands to checker id + model version
 * + config + prompt version. Inputs serialize with SORTED keys before hashing, so
 * semantically identical configs cannot produce distinct keys (order-invariance test).
 *
 * Invalidation is BY CONSTRUCTION: version-in-key makes stale entries unreachable on any
 * deploy that bumps a checker/prompt/source version. An extractor swap re-versions
 * `sourceVersionHash`, so dependent verdicts miss automatically. GC is lazy (TTL); explicit
 * purge (recalled verdicts / a legally-tainted model) walks the checker-version -> entries
 * index -- this is what makes tier-2 rollback eviction possible (plugpoints removability
 * check 4).
 *
 * The store itself is a PORT (VerdictCacheStore): the in-memory map here is the keyless
 * default used by the harness and tests; a Postgres/Redis-backed store is host-app wiring.
 * connect-core stays MIT with no DB deps.
 *
 * No node:crypto -- hashing uses the same Web Crypto path as evidence-binding.ts
 * (contentHash), safe if barrel-imported on a client.
 */
import { contentHash } from "../ingest/evidence-binding.js";
import type { Verdict } from "./verdict.js";

/** Every field is mandatory. Omitting one is a Blocker (skill sec-6). */
export interface VerdictCacheKeyInputs {
  /** Decontextualized claim text, in the declared offset unit (skill sec-2). */
  claimTextCanonical: string;
  /** The source SPAN (a locator/quote), never a chunk index (skill sec-2). */
  sourceSpan: string;
  /** Canonical extracted-text version hash (SHA-256 hex from contentHash). */
  sourceVersionHash: string;
  /** Deciding tier's id, e.g. "granite-guardian-3.3-8b". */
  checkerId: string;
  /** Deciding tier's model version. */
  checkerModelVersion: string;
  /** Deciding tier's config hash (temperature, tools, params -- sorted keys upstream). */
  checkerConfigHash: string;
  /** Prompt/template version (bumped on any judge-prompt wording change). */
  promptTemplateVersion: string | number;
}

/** A cached verdict record. Neutral shape -- no vendor payload fields (plugpoints check 3). */
export interface CachedVerdict {
  verdict: Verdict;
  confidence: number | null;
  /** The deciding tier id, redundantly stored for the checker-version -> entries index. */
  checkerId: string;
  checkerModelVersion: string;
  /** ISO 8601 write time (drives TTL/LRU GC). */
  storedAt: string;
  note?: string;
}

/**
 * Deterministic, order-invariant serialization: object keys sorted recursively, so two
 * semantically identical configs serialize identically (skill sec-6 order-invariance).
 */
export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(rec).sort()) out[k] = sortKeys(rec[k]);
    return out;
  }
  return value;
}

/**
 * Compose the exact-match cache key. Every field participates; a sorted serialization is
 * hashed with SHA-256. Changing ANY field yields a different key (the key-discrimination
 * tests enumerate every field).
 */
export async function verdictCacheKey(inputs: VerdictCacheKeyInputs): Promise<string> {
  // Normalize the version field to a string so 1 and "1" cannot key differently.
  const normalized = {
    claimTextCanonical: inputs.claimTextCanonical,
    sourceSpan: inputs.sourceSpan,
    sourceVersionHash: inputs.sourceVersionHash,
    checkerId: inputs.checkerId,
    checkerModelVersion: inputs.checkerModelVersion,
    checkerConfigHash: inputs.checkerConfigHash,
    promptTemplateVersion: String(inputs.promptTemplateVersion),
  };
  return contentHash(canonicalSerialize(normalized));
}

/**
 * The cache store port. A hit MUST be exact-match on the composed key; there is no
 * approximate-match method on this interface by design (skill sec-6). Host apps back this
 * with Postgres/Redis; the in-memory default lives below.
 */
export interface VerdictCacheStore {
  get(key: string): Promise<CachedVerdict | undefined>;
  set(key: string, value: CachedVerdict): Promise<void>;
  /** Purge every entry for a (checkerId, checkerModelVersion) pair; returns the count. */
  purgeByChecker(checkerId: string, checkerModelVersion: string): Promise<number>;
  size(): Promise<number>;
}

/** Outcome of a single lookup -- logged per lookup so sec-8 can value the avoided tier. */
export interface CacheLookup {
  hit: boolean;
  key: string;
}

/**
 * In-memory exact-match store with a checker-version -> keys index (for purge) and optional
 * TTL/LRU GC. Default, keyless implementation -- used by the harness and tests. No semantic
 * anything.
 */
export class InMemoryVerdictCache implements VerdictCacheStore {
  private readonly map = new Map<string, CachedVerdict>();
  /** checkerId::modelVersion -> set of cache keys, for purge-by-checker (tier-2 eviction). */
  private readonly byChecker = new Map<string, Set<string>>();
  private readonly ttlMs: number | null;
  private readonly maxEntries: number | null;

  constructor(opts?: { ttlMs?: number; maxEntries?: number }) {
    this.ttlMs = opts?.ttlMs ?? null;
    this.maxEntries = opts?.maxEntries ?? null;
  }

  async get(key: string): Promise<CachedVerdict | undefined> {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (this.ttlMs !== null) {
      const age = Date.now() - new Date(entry.storedAt).getTime();
      if (age > this.ttlMs) {
        // Lazy GC: expired entries are unreachable, never wrong (skill sec-6 invalidation).
        this.remove(key, entry);
        return undefined;
      }
    }
    return entry;
  }

  async set(key: string, value: CachedVerdict): Promise<void> {
    this.map.set(key, value);
    const idxKey = checkerIndexKey(value.checkerId, value.checkerModelVersion);
    let set = this.byChecker.get(idxKey);
    if (!set) {
      set = new Set<string>();
      this.byChecker.set(idxKey, set);
    }
    set.add(key);
    if (this.maxEntries !== null && this.map.size > this.maxEntries) this.evictOldest();
  }

  async purgeByChecker(checkerId: string, checkerModelVersion: string): Promise<number> {
    const idxKey = checkerIndexKey(checkerId, checkerModelVersion);
    const keys = this.byChecker.get(idxKey);
    if (!keys) return 0;
    let count = 0;
    for (const key of keys) {
      if (this.map.delete(key)) count += 1;
    }
    this.byChecker.delete(idxKey);
    return count;
  }

  async size(): Promise<number> {
    return this.map.size;
  }

  private remove(key: string, entry: CachedVerdict): void {
    this.map.delete(key);
    const idxKey = checkerIndexKey(entry.checkerId, entry.checkerModelVersion);
    this.byChecker.get(idxKey)?.delete(key);
  }

  private evictOldest(): void {
    // LRU-ish: evict the oldest storedAt. Orphans a cache entry, never corrupts one.
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [k, v] of this.map) {
      const t = new Date(v.storedAt).getTime();
      if (t < oldestAt) {
        oldestAt = t;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      const entry = this.map.get(oldestKey)!;
      this.remove(oldestKey, entry);
    }
  }
}

function checkerIndexKey(checkerId: string, modelVersion: string): string {
  return `${checkerId}::${modelVersion}`;
}
