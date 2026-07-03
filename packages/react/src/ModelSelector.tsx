"use client";

import { useRef, useEffect, useCallback } from "react";
import type { KeysInstance } from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";
import "@restormel/keys-elements";
import type { RkModelSelectorElement } from "./elements";

export interface ModelSelectorProps {
  keys: KeysInstance | null;
  providers: ProviderDefinition[];
  onSelect?: (modelId: string, providerId: string) => void;
}

export function ModelSelector({
  keys,
  providers,
  onSelect,
}: ModelSelectorProps): React.ReactElement {
  const ref = useRef<RkModelSelectorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.keys = keys;
    el.providers = providers;
  }, [keys, providers]);

  const onSelectStable = useCallback(
    (e: Event) => {
      const ev = e as CustomEvent<{ modelId: string; providerId: string }>;
      onSelect?.(ev.detail.modelId, ev.detail.providerId);
    },
    [onSelect]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("rk-model-selected", onSelectStable);
    return () => el.removeEventListener("rk-model-selected", onSelectStable);
  }, [onSelectStable]);

  return <rk-model-selector ref={ref} />;
}
