"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { KeyConfig } from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";
import { FALLBACK_PROVIDERS, providerDefinitionsFromCatalog } from "@/app/lib/catalog";
import type { CanonicalCatalogResponse } from "@restormel/keys/dashboard";

const DEMO_USER = "demo-user";
const API = "/api/keys";
const CATALOG_API = "/api/catalog";

const SettingsContentInner = dynamic(
  () => import("./SettingsContentInner").then((m) => ({ default: m.SettingsContentInner })),
  { ssr: false }
);

export function SettingsClient() {
  const [keysList, setKeysList] = useState<KeyConfig[]>([]);
  const [providers, setProviders] = useState<ProviderDefinition[]>(FALLBACK_PROVIDERS);
  const [catalogSource, setCatalogSource] = useState<"restormel" | "fallback">("fallback");
  const [catalogReason, setCatalogReason] = useState<string>("");
  const refetch = useCallback(() => {
    fetch(API, { headers: { "x-user-id": DEMO_USER } })
      .then((r) => r.json())
      .then((d) => setKeysList((d.keys ?? []) as KeyConfig[]))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    fetch(CATALOG_API)
      .then((r) => r.json())
      .then((d) => {
        const body = d as {
          source?: "restormel" | "fallback";
          degradedReason?: string;
          catalog?: CanonicalCatalogResponse;
        };
        const catalog = body.catalog;
        if (!catalog) return;
        setCatalogSource(body.source ?? "fallback");
        setCatalogReason(body.degradedReason ?? "");
        setProviders(providerDefinitionsFromCatalog(catalog));
      })
      .catch(() => {
        setCatalogSource("fallback");
        setCatalogReason("catalog_fetch_failed");
        setProviders(FALLBACK_PROVIDERS);
      });
  }, []);

  return (
    <SettingsContentInner
      keysList={keysList}
      providers={providers}
      catalogSource={catalogSource}
      catalogReason={catalogReason}
      refetch={refetch}
    />
  );
}
