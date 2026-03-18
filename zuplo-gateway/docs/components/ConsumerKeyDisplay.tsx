import React from "react";
import { useAuth } from "zudoku/components";
import { SignInButton } from "./SignInButton";

export function ConsumerKeyDisplay(props: { endpoint: string }) {
  const { endpoint } = props;
  const auth = useAuth?.();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [key, setKey] = React.useState<string | null>(null);
  const [revealed, setRevealed] = React.useState(false);

  const isAuthEnabled = Boolean(auth?.isAuthEnabled);
  const isPending = Boolean(auth?.isPending);
  const isAuthenticated = Boolean(auth?.isAuthenticated);

  React.useEffect(() => {
    if (!isAuthEnabled) {
      setLoading(false);
      setError(null);
      setKey(null);
      return;
    }
    if (isPending) {
      setLoading(true);
      return;
    }
    if (!isAuthenticated) {
      setLoading(false);
      setError(null);
      setKey(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function fetchWithRetry(attempt: number): Promise<void> {
      const getToken = (auth as { getAccessToken?: () => string | Promise<string> })?.getAccessToken;
      const token = getToken ? await Promise.resolve(getToken()) : "";
      const headers: Record<string, string> = {};
      if (typeof token === "string" && token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(endpoint, { headers });
      if (res.status === 401 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        if (!cancelled) return fetchWithRetry(attempt + 1);
        return;
      }
      if (res.status === 401) {
        if (!cancelled) {
          setError("sign_in_required");
          setKey(null);
        }
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { key?: string; error?: string; detail?: string };
      if (!res.ok) {
        if (!cancelled) setError(json?.error ?? json?.detail ?? "Failed to load key.");
        return;
      }
      const k = json?.key;
      if (typeof k !== "string" || !k.startsWith("zpka_")) {
        if (!cancelled) setError("Invalid key response.");
        return;
      }
      if (!cancelled) setKey(k);
    }

    fetchWithRetry(0)
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load key.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token fetch when session gates flip
  }, [endpoint, isAuthEnabled, isPending, isAuthenticated]);

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

  if (!isAuthEnabled) {
    return (
      <p style={{ color: "var(--z-muted)" }}>
        Sign-in is not configured on this portal. Use a consumer key from your Zuplo project settings if available.
      </p>
    );
  }

  if (isPending) return <div style={{ color: "var(--z-muted)" }}>Checking session…</div>;

  if (!isAuthenticated) {
    return (
      <div
        style={{
          border: "1px solid var(--z-border)",
          borderRadius: 10,
          padding: 20,
          background: "var(--z-surface)",
          maxWidth: 560,
        }}
      >
        <p style={{ margin: "0 0 12px", lineHeight: 1.5 }}>
          Sign in to load your consumer key from Restormel. This uses a full page navigation so the session is shared
          with the dashboard.
        </p>
        <SignInButton />
      </div>
    );
  }

  if (loading) return <div style={{ color: "var(--z-muted)" }}>Loading your key…</div>;

  if (error === "sign_in_required") {
    return (
      <div style={{ maxWidth: 560 }}>
        <p style={{ color: "var(--z-danger)", marginBottom: 12 }}>
          We could not load your key with this session. Sign in again.
        </p>
        <SignInButton>Sign in again</SignInButton>
      </div>
    );
  }

  if (error) {
    return <div style={{ color: "var(--z-danger)" }}>{error}</div>;
  }

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
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
        Use as <code>Authorization: Bearer zpka_…</code> on the gateway base URL. In the API reference playground,
        choose the <strong>My consumer key (zpka_…)</strong> identity.
      </div>
    </div>
  );
}
