"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createKeys } from "@restormel/keys";
import type { KeysConfig, CreateKeysOptions, KeysInstance } from "@restormel/keys";

export interface KeysContextValue {
  keys: KeysInstance | null;
  loading: boolean;
  error: Error | null;
}

const KeysContext = createContext<KeysContextValue | null>(null);

export interface KeysProviderProps {
  config: KeysConfig;
  options?: CreateKeysOptions;
  children: ReactNode;
}

export function KeysProvider({ config, options, children }: KeysProviderProps): React.ReactElement {
  const value = useMemo<KeysContextValue>(() => {
    try {
      const instance = createKeys(config, options);
      return { keys: instance, loading: false, error: null };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      return { keys: null, loading: false, error: err };
    }
  }, [config, options]);

  return <KeysContext.Provider value={value}>{children}</KeysContext.Provider>;
}

export function useKeysContext(): KeysContextValue {
  const ctx = useContext(KeysContext);
  if (ctx == null) {
    throw new Error("useKeysContext must be used within a KeysProvider");
  }
  return ctx;
}
