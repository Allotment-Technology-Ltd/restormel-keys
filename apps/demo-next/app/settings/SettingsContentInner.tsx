"use client";

import { KeysProvider, KeyManager, ModelSelector, useKeysContext } from "@restormel/keys-react";
import type { ProviderDefinition } from "@restormel/keys";
import type { KeyConfig } from "@restormel/keys";

const DEMO_USER = "demo-user";
const API = "/api/keys";

function Inner({ refetch, providers }: { refetch: () => void; providers: ProviderDefinition[] }) {
  const { keys } = useKeysContext();
  return (
    <div data-testid="settings-client-content" style={{ padding: "1.5rem", maxWidth: "32rem" }}>
      <h2>Provider credentials</h2>
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
  providers,
  catalogSource,
  catalogReason,
  refetch,
}: {
  keysList: KeyConfig[];
  providers: ProviderDefinition[];
  catalogSource: "restormel" | "fallback";
  catalogReason?: string;
  refetch: () => void;
}) {
  const defaultProvider = providers[0]?.id ?? "openai";
  return (
    <KeysProvider
      config={{ keys: keysList, routing: { defaultProvider } }}
      options={{ providers }}
    >
      {catalogSource === "fallback" ? (
        <p
          style={{
            margin: "1rem 1.5rem 0",
            fontSize: "0.85rem",
            color: "#b8b8b8",
          }}
        >
          Using fallback provider catalog{catalogReason ? ` (${catalogReason})` : ""}. Canonical feed unavailable.
        </p>
      ) : null}
      <Inner refetch={refetch} providers={providers} />
    </KeysProvider>
  );
}
