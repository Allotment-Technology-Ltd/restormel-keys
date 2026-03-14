"use client";

import { useRef, useEffect, useCallback } from "react";
import type { KeysInstance } from "@restormel/keys";
import type { KeyConfig } from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";
import "@restormel/keys-elements";
import type { RkKeyManagerElement } from "./elements";

export interface KeyManagerProps {
  keys: KeysInstance | null;
  userId: string;
  providers?: ProviderDefinition[];
  onKeyAdded?: (key: KeyConfig, apiKey?: string) => void;
  onKeyRemoved?: (keyId: string) => void;
}

export function KeyManager({
  keys,
  userId,
  providers = [],
  onKeyAdded,
  onKeyRemoved,
}: KeyManagerProps): React.ReactElement {
  const ref = useRef<RkKeyManagerElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.keys = keys;
    el.userId = userId;
    el.providers = providers;
  }, [keys, userId, providers]);

  const onKeyAddedStable = useCallback(
    (e: Event) => {
      const ev = e as CustomEvent<{ key: KeyConfig; apiKey?: string }>;
      onKeyAdded?.(ev.detail.key, ev.detail.apiKey);
    },
    [onKeyAdded]
  );
  const onKeyRemovedStable = useCallback(
    (e: Event) => {
      const ev = e as CustomEvent<{ keyId: string }>;
      onKeyRemoved?.(ev.detail.keyId);
    },
    [onKeyRemoved]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("rk-key-added", onKeyAddedStable);
    el.addEventListener("rk-key-removed", onKeyRemovedStable);
    return () => {
      el.removeEventListener("rk-key-added", onKeyAddedStable);
      el.removeEventListener("rk-key-removed", onKeyRemovedStable);
    };
  }, [onKeyAddedStable, onKeyRemovedStable]);

  return <rk-key-manager ref={ref} user-id={userId} />;
}
