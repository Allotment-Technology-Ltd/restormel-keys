"use client";

import { useMemo } from "react";
import type { KeysInstance } from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";

export interface ModelGroup {
  providerId: string;
  providerName: string;
  modelIds: string[];
}

export interface UseModelsResult {
  modelIds: string[];
  groups: ModelGroup[];
}

/**
 * Returns available model ids from keys, optionally grouped by provider.
 */
export function useModels(
  keys: KeysInstance | null,
  providers: ProviderDefinition[] = []
): UseModelsResult {
  return useMemo(() => {
    if (!keys) return { modelIds: [], groups: [] };
    const modelIds = keys.getAllModelIds();
    const groups: ModelGroup[] =
      providers.length > 0
        ? providers.map((p) => ({
            providerId: p.id,
            providerName: p.name,
            modelIds: p.models,
          }))
        : [{ providerId: "", providerName: "", modelIds }];
    return { modelIds, groups };
  }, [keys, providers]);
}
