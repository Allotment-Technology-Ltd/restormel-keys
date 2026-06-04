import type { PhilosophicalDomain } from "@restormel/contracts/domains";

/** Target mix for inquiry-time retrieval seed selection (not operator dataset metrics). */
export type RetrievalOriginBalanceKey = "sep" | "gutenberg" | "other";

/** Default SEP / Gutenberg / other mix for seed claims (sums to 1). */
export const IDEAL_RETRIEVAL_ORIGIN_FRACTIONS: Record<RetrievalOriginBalanceKey, number> = {
  sep: 0.42,
  gutenberg: 0.33,
  other: 0.25,
};

export const RETRIEVAL_ORIGIN_BALANCE_STRENGTH = 0.95;
export const RETRIEVAL_DOMAIN_BALANCE_STRENGTH = 0.85;

export function isRetrievalKgBalanceEnabled(): boolean {
  const v = (process.env.RETRIEVAL_KG_BALANCE ?? "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no" && v !== "off";
}

function normalizeFractions<T extends string>(w: Record<T, number>): Record<T, number> {
  const sum = (Object.values(w) as number[]).reduce(
    (a, b) => a + (Number.isFinite(b) ? b : 0),
    0
  );
  if (sum <= 0) return { ...w };
  const out = {} as Record<T, number>;
  for (const k of Object.keys(w) as T[]) {
    out[k] = w[k] / sum;
  }
  return out;
}

/** Multiplicative boost for MMR relevance (1 = neutral). Uses deficit vs ideal fractions. */
export function computeKgBalanceMultiplier(params: {
  origin: RetrievalOriginBalanceKey;
  domain: PhilosophicalDomain | string | null | undefined;
  selectedOriginCounts: Record<RetrievalOriginBalanceKey, number>;
  selectedDomainCounts: Map<string, number>;
  totalSelected: number;
  idealOrigin: Record<RetrievalOriginBalanceKey, number>;
  domainsInPool: Set<string>;
  originStrength?: number;
  domainStrength?: number;
}): number {
  const {
    origin,
    domain,
    selectedOriginCounts,
    selectedDomainCounts,
    totalSelected,
    idealOrigin,
    domainsInPool,
    originStrength = RETRIEVAL_ORIGIN_BALANCE_STRENGTH,
    domainStrength = RETRIEVAL_DOMAIN_BALANCE_STRENGTH,
  } = params;

  if (totalSelected === 0) return 1;

  const idealO = normalizeFractions(idealOrigin);
  const curO = selectedOriginCounts[origin] / totalSelected;
  const tgtO = idealO[origin] ?? 0;
  const originMult =
    tgtO > 0 ? 1 + originStrength * Math.max(0, (tgtO - curO) / Math.max(0.08, tgtO)) : 1;

  let domainMult = 1;
  const nDom = domainsInPool.size;
  if (nDom > 1 && domain) {
    const dKey = String(domain);
    if (domainsInPool.has(dKey)) {
      const idealD = 1 / nDom;
      const curD = (selectedDomainCounts.get(dKey) ?? 0) / totalSelected;
      domainMult = 1 + domainStrength * Math.max(0, (idealD - curD) / Math.max(0.06, idealD));
    }
  }

  return Math.min(2.4, originMult * domainMult);
}
