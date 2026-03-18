const ZUPLO_API_BASE = "https://dev.zuplo.com/v1";

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function zuploHeaders(): Record<string, string> {
  const apiKey = requiredEnv("ZUPLO_API_KEY");
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

function consumerNameForWorkspace(workspaceId: string): string {
  return `ws_${workspaceId}`;
}

type ZuploConsumerWithKeys = {
  apiKeys?: Array<{ key?: string; expiresOn?: string | null; revokedOn?: string | null }>;
};

export async function ensureZuploConsumer(params: {
  workspaceId: string;
  userEmail?: string | null;
}): Promise<string> {
  const account = requiredEnv("ZUPLO_ACCOUNT_NAME");
  const bucket = requiredEnv("ZUPLO_BUCKET_NAME");
  const consumerName = consumerNameForWorkspace(params.workspaceId);

  const getUrl = `${ZUPLO_API_BASE}/accounts/${encodeURIComponent(account)}/key-buckets/${encodeURIComponent(
    bucket
  )}/consumers/${encodeURIComponent(consumerName)}?include-api-keys=true`;

  const existing = await fetch(getUrl, { headers: zuploHeaders() });
  if (existing.ok) {
    const data = (await existing.json().catch(() => ({}))) as ZuploConsumerWithKeys;
    const activeKey = (data.apiKeys ?? []).find((k) => {
      if (!k?.key) return false;
      if (k.revokedOn) return false;
      if (!k.expiresOn) return true;
      const exp = Date.parse(k.expiresOn);
      return Number.isFinite(exp) ? exp > Date.now() : true;
    });
    if (activeKey?.key && activeKey.key.startsWith("zpka_")) return activeKey.key;
  }

  const createUrl = `${ZUPLO_API_BASE}/accounts/${encodeURIComponent(account)}/key-buckets/${encodeURIComponent(
    bucket
  )}/consumers?with-api-key=true`;

  const res = await fetch(createUrl, {
    method: "POST",
    headers: zuploHeaders(),
    body: JSON.stringify({
      name: consumerName,
      description: `Restormel workspace ${params.workspaceId}`,
      metadata: { workspaceId: params.workspaceId, email: params.userEmail ?? null },
      tags: { workspaceId: params.workspaceId },
    }),
  });

  const created = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const detail = created?.error ?? created?.message ?? created?.detail ?? res.statusText;
    throw new Error(`Zuplo consumer create failed (${res.status}): ${String(detail)}`);
  }
  const key = created?.apiKeys?.[0]?.key;
  if (typeof key !== "string" || !key.startsWith("zpka_")) throw new Error("Zuplo response missing consumer key");
  return key;
}

