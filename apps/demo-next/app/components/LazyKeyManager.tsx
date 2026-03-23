"use client";

import dynamic from "next/dynamic";
import { FALLBACK_PROVIDERS } from "@/app/lib/catalog";
import { KeysProvider, useKeysContext } from "@restormel/keys-react";

const KeyManager = dynamic(
  () => import("@restormel/keys-react").then((m) => m.KeyManager),
  { ssr: false }
);

const DEMO_USER = "demo-user";
const API = "/api/keys";

function LazyKeyManagerInner() {
  const { keys } = useKeysContext();
  return (
    <KeyManager
      keys={keys}
      userId={DEMO_USER}
        providers={FALLBACK_PROVIDERS}
      onKeyAdded={async (key, apiKey) => {
        await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": DEMO_USER },
          body: JSON.stringify({
            provider: key.provider,
            apiKey,
            id: (key as { id?: string }).id,
          }),
        });
      }}
      onKeyRemoved={async (keyId) => {
        await fetch(`${API}/${keyId}`, {
          method: "DELETE",
          headers: { "x-user-id": DEMO_USER },
        });
      }}
    />
  );
}

export function LazyKeyManager() {
  const config = { keys: [], routing: { defaultProvider: "openai" } };
  const options = {
    providers: FALLBACK_PROVIDERS,
    getByokKeys: async () => {
      const r = await fetch(API, { headers: { "x-user-id": DEMO_USER } });
      const d = await r.json();
      return (d.keys ?? []) as { id?: string; provider: string; label?: string }[];
    },
  };
  return (
    <KeysProvider config={config} options={options}>
      <LazyKeyManagerInner />
    </KeysProvider>
  );
}
