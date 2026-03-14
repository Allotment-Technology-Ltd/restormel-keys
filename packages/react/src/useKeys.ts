"use client";

import { useMemo, useState } from "react";
import { createKeys } from "@restormel/keys";
import type { KeysConfig } from "@restormel/keys";
import type { CreateKeysOptions } from "@restormel/keys";
import type { KeysInstance } from "@restormel/keys";

export interface UseKeysResult {
  keys: KeysInstance | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Initialises createKeys() with config and options. Returns instance, loading, and error.
 * For async getByokKeys, loading is true until the first resolve.
 */
export function useKeys(
  config: KeysConfig,
  options?: CreateKeysOptions
): UseKeysResult {
  const [error, setError] = useState<Error | null>(null);
  const keys = useMemo(() => {
    try {
      setError(null);
      return createKeys(config, options);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      return null;
    }
  }, [config, options?.providers, options?.getByokKeys, options?.getPlatformKey]);

  return {
    keys,
    loading: false,
    error: error ?? null,
  };
}
