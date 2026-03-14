"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { KeyConfig } from "@restormel/keys";

const DEMO_USER = "demo-user";
const API = "/api/keys";

const SettingsContentInner = dynamic(
  () => import("./SettingsContentInner").then((m) => ({ default: m.SettingsContentInner })),
  { ssr: false }
);

export function SettingsClient() {
  const [keysList, setKeysList] = useState<KeyConfig[]>([]);
  const refetch = useCallback(() => {
    fetch(API, { headers: { "x-user-id": DEMO_USER } })
      .then((r) => r.json())
      .then((d) => setKeysList((d.keys ?? []) as KeyConfig[]))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refetch();
  }, [refetch]);
  return <SettingsContentInner keysList={keysList} refetch={refetch} />;
}
