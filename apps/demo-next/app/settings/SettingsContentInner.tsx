"use client";

import { KeysProvider, KeyManager, ModelSelector, useKeysContext } from "@restormel/keys-react";
import { openaiProvider, anthropicProvider } from "@restormel/keys";
import type { KeyConfig } from "@restormel/keys";

const DEMO_USER = "demo-user";
const API = "/api/keys";
const providers = [openaiProvider, anthropicProvider];

function Inner({ refetch }: { refetch: () => void }) {
  const { keys } = useKeysContext();
  return (
    <div data-testid="settings-client-content" style={{ padding: "1.5rem", maxWidth: "32rem" }}>
      <h2>API keys</h2>
      <KeyManager
        keys={keys}
        userId={DEMO_USER}
        providers={providers}
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
          refetch();
        }}
        onKeyRemoved={async (keyId) => {
          await fetch(`${API}/${keyId}`, {
            method: "DELETE",
            headers: { "x-user-id": DEMO_USER },
          });
          refetch();
        }}
      />
      <h2 style={{ marginTop: "2rem" }}>Models</h2>
      <ModelSelector
        keys={keys}
        providers={providers}
        onSelect={(modelId, providerId) => {
          console.log("Selected", modelId, providerId);
        }}
      />
    </div>
  );
}

export function SettingsContentInner({
  keysList,
  refetch,
}: {
  keysList: KeyConfig[];
  refetch: () => void;
}) {
  return (
    <KeysProvider
      config={{ keys: keysList, routing: { defaultProvider: "openai" } }}
      options={{ providers }}
    >
      <Inner refetch={refetch} />
    </KeysProvider>
  );
}
