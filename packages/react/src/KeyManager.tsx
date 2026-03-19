"use client";

import { useRef, useEffect, useCallback } from "react";
import type { KeysInstance } from "@restormel/keys";
import type { KeyConfig, KeyAddResult, KeyRemoveResult } from "@restormel/keys";
import type { ProviderDefinition, ProviderValidationResult } from "@restormel/keys";
import "@restormel/keys-elements";
import type { RkKeyManagerElement } from "./elements";

export interface KeyManagerProps {
  keys: KeysInstance | null;
  userId: string;
  providers?: ProviderDefinition[];
  /**
   * Called when a key is added. Return a KeyAddResult or promise for async persistence.
   * The component shows saving state and only closes on { ok: true }.
   */
  onKeyAdded?: (key: KeyConfig, apiKey?: string) => void | KeyAddResult | Promise<void | KeyAddResult>;
  /**
   * Called when a key is removed. Return a KeyRemoveResult or promise for async persistence.
   * The component shows removing state and only clears on { ok: true }.
   */
  onKeyRemoved?: (keyId: string) => void | KeyRemoveResult | Promise<void | KeyRemoveResult>;
  /**
   * Host-driven validation. If provided, the component calls this instead of
   * provider.validateKey. Use for server-side validation.
   */
  onValidate?: (provider: string, rawCredential: string) => Promise<ProviderValidationResult>;
  /**
   * Revalidate an existing saved key (server-side). Prefer this over overloading
   * onValidate with an empty rawCredential sentinel.
   */
  onRevalidate?: (keyId: string, provider: string) => Promise<ProviderValidationResult>;
}

export function KeyManager({
  keys,
  userId,
  providers = [],
  onKeyAdded,
  onKeyRemoved,
  onValidate,
  onRevalidate,
}: KeyManagerProps): React.ReactElement {
  const ref = useRef<RkKeyManagerElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.keys = keys;
    el.userId = userId;
    el.providers = providers;
    el.onValidate = onValidate;
    el.onRevalidate = onRevalidate;
  }, [keys, userId, providers, onValidate, onRevalidate]);

  const onKeyAddedStable = useCallback(
    async (e: Event) => {
      const ev = e as CustomEvent<{ key: KeyConfig; apiKey?: string }>;
      const result = await onKeyAdded?.(ev.detail.key, ev.detail.apiKey);
      return result;
    },
    [onKeyAdded],
  );
  const onKeyRemovedStable = useCallback(
    async (e: Event) => {
      const ev = e as CustomEvent<{ keyId: string }>;
      const result = await onKeyRemoved?.(ev.detail.keyId);
      return result;
    },
    [onKeyRemoved],
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
