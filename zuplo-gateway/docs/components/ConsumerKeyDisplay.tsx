import React from "react";
import { useAuth } from "zudoku/components";

export function ConsumerKeyDisplay(props: { endpoint: string }) {
  const { endpoint } = props;
  const auth = useAuth?.();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [key, setKey] = React.useState<string | null>(null);
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const headers: Record<string, string> = {};
    try {
      const token = (auth as any)?.getAccessToken?.();
      // getAccessToken may be sync or async depending on provider
      Promise.resolve(token)
        .then((t) => {
          if (typeof t === "string" && t) headers.Authorization = `Bearer ${t}`;
          return fetch(endpoint, { headers });
        })
        .then(async (res) => {
          if (res.status === 401) throw new Error("Sign in to view your key.");
          const json = (await res.json().catch(() => ({}))) as any;
          if (!res.ok) throw new Error(json?.error ?? json?.detail ?? "Failed to load key.");
          const k = json?.key;
          if (typeof k !== "string" || !k.startsWith("zpka_")) throw new Error("Invalid key response.");
          if (!cancelled) setKey(k);
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load key.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load key.");
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const masked = React.useMemo(() => {
    if (!key) return "";
    if (key.length <= 12) return `${key.slice(0, 6)}…`;
    return `${key.slice(0, 8)}…${key.slice(-4)}`;
  }, [key]);

  async function copy() {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
    } catch {
      // no-op
    }
  }

  if (loading) return <div style={{ color: "var(--z-muted)" }}>Loading…</div>;
  if (error) return <div style={{ color: "var(--z-danger)" }}>{error}</div>;
  if (!key) return null;

  return (
    <div
      style={{
        border: "1px solid var(--z-border)",
        borderRadius: 10,
        padding: 16,
        background: "var(--z-surface)",
        maxWidth: 560,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Consumer key</div>
      <div
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: 14,
          color: "var(--z-text)",
          marginBottom: 12,
          wordBreak: "break-all",
        }}
      >
        {revealed ? key : masked}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          style={{
            border: "1px solid var(--z-border)",
            borderRadius: 10,
            padding: "8px 12px",
            background: "transparent",
            color: "var(--z-text)",
            cursor: "pointer",
          }}
        >
          {revealed ? "Hide" : "Reveal"}
        </button>
        <button
          type="button"
          onClick={copy}
          style={{
            border: "1px solid var(--z-border)",
            borderRadius: 10,
            padding: "8px 12px",
            background: "transparent",
            color: "var(--z-text)",
            cursor: "pointer",
          }}
        >
          Copy
        </button>
      </div>
      <div style={{ marginTop: 10, color: "var(--z-muted)", fontSize: 13 }}>
        Use this key as <code>Authorization: Bearer zpka_...</code> when calling the gateway API.
      </div>
    </div>
  );
}

