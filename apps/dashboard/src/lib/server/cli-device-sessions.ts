/**
 * CLI device linking (OAuth 2.0 device grant patterns). Ephemeral pending_raw_key; never log raw values.
 */
import { env } from "$env/dynamic/private";
import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes, randomUUID } from "crypto";
import { createApiKey, deleteApiKey, getProject } from "./neon";

const DEVICE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 5000;
const MAX_POLLS = 120;
const STARTS_PER_IP_PER_HOUR = 30;
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function getSql() {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

function hashDeviceCode(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function randomDeviceCode(): string {
  return randomBytes(32).toString("base64url");
}

function randomUserCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) {
    const j = randomBytes(1)[0]! % USER_CODE_ALPHABET.length;
    s += USER_CODE_ALPHABET[j];
  }
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizeUserCode(input: string): string {
  const cleaned = input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (cleaned.length !== 8) return "";
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}

export type StartCliDeviceResult = {
  deviceCode: string;
  userCode: string;
  expiresIn: number;
  interval: number;
};

export async function cleanupExpiredCliDeviceSessions(): Promise<void> {
  const sql = getSql();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  await sql`DELETE FROM cli_device_sessions WHERE expires_at < ${cutoff}`;
}

export async function startCliDeviceSession(
  requestIp: string | null
): Promise<StartCliDeviceResult | { error: string }> {
  await cleanupExpiredCliDeviceSessions();
  const sql = getSql();
  const hourAgo = Date.now() - 60 * 60 * 1000;
  if (requestIp) {
    const rows = await sql`
      SELECT COUNT(*)::bigint AS c FROM cli_device_sessions
      WHERE request_ip = ${requestIp} AND created_at > ${hourAgo}
    `;
    const c = Number((rows[0] as { c?: string | number | bigint } | undefined)?.c ?? 0);
    if (c >= STARTS_PER_IP_PER_HOUR) return { error: "rate_limited" };
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const id = randomUUID();
    const deviceCode = randomDeviceCode();
    const deviceHash = hashDeviceCode(deviceCode);
    const userCode = randomUserCode();
    const now = Date.now();
    const expiresAt = now + DEVICE_TTL_MS;
    try {
      await sql`
        INSERT INTO cli_device_sessions (
          id, device_code_hash, user_code, expires_at, interval_ms, status, created_at, request_ip
        ) VALUES (
          ${id}, ${deviceHash}, ${userCode}, ${expiresAt}, ${DEFAULT_INTERVAL_MS}, 'pending', ${now}, ${requestIp}
        )
      `;
      return {
        deviceCode,
        userCode,
        expiresIn: Math.floor(DEVICE_TTL_MS / 1000),
        interval: Math.floor(DEFAULT_INTERVAL_MS / 1000),
      };
    } catch {
      /* unique collision */
    }
  }
  return { error: "try_again" };
}

export type PollCliDeviceResult =
  | { error: "authorization_pending" }
  | { error: "slow_down" }
  | { error: "expired_token" | "access_denied" | "invalid_grant" }
  | { accessToken: string; tokenType: "Bearer"; projectId: string; keyPrefix: string };

export async function pollCliDeviceSession(deviceCode: string): Promise<PollCliDeviceResult> {
  const sql = getSql();
  const deviceHash = hashDeviceCode(deviceCode);
  const now = Date.now();

  const rows = await sql`
    SELECT id, expires_at AS "expiresAt", interval_ms AS "intervalMs", status,
           last_poll_at AS "lastPollAt", poll_count AS "pollCount"
    FROM cli_device_sessions
    WHERE device_code_hash = ${deviceHash}
    LIMIT 1
  `;
  type Row = {
    id: string;
    expiresAt: number | string | bigint;
    intervalMs: number | string | bigint;
    status: string;
    lastPollAt: number | null | string | bigint;
    pollCount: number | string | bigint;
  };
  const row = rows[0] as Row | undefined;
  if (!row) return { error: "invalid_grant" };

  const expiresAt = Number(row.expiresAt);
  if (now > expiresAt) {
    await sql`
      UPDATE cli_device_sessions SET status = 'expired'
      WHERE id = ${row.id} AND status IN ('pending','authorized')
    `;
    return { error: "expired_token" };
  }

  if (row.status === "consumed" || row.status === "denied" || row.status === "expired") {
    return { error: row.status === "denied" ? "access_denied" : "invalid_grant" };
  }

  if (row.status === "authorized") {
    const consumed = await sql`
      UPDATE cli_device_sessions
      SET status = 'consumed', consumed_at = ${now}, pending_raw_key = NULL
      WHERE id = ${row.id} AND status = 'authorized' AND pending_raw_key IS NOT NULL
      RETURNING pending_raw_key AS "pendingRawKey", result_key_prefix AS "resultKeyPrefix", project_id AS "projectId"
    `;
    const d = consumed[0] as
      | { pendingRawKey: string; resultKeyPrefix: string; projectId: string }
      | undefined;
    if (!d?.pendingRawKey) return { error: "invalid_grant" };
    return {
      accessToken: d.pendingRawKey,
      tokenType: "Bearer",
      projectId: d.projectId,
      keyPrefix: d.resultKeyPrefix,
    };
  }

  const pollCount = Number(row.pollCount);
  if (pollCount >= MAX_POLLS) {
    await sql`UPDATE cli_device_sessions SET status = 'expired' WHERE id = ${row.id}`;
    return { error: "expired_token" };
  }
  const intervalMs = Number(row.intervalMs);
  const lastPoll = row.lastPollAt != null ? Number(row.lastPollAt) : 0;
  if (lastPoll && now - lastPoll < intervalMs) {
    return { error: "slow_down" };
  }
  await sql`
    UPDATE cli_device_sessions
    SET last_poll_at = ${now}, poll_count = poll_count + 1
    WHERE id = ${row.id}
  `;
  return { error: "authorization_pending" };
}

export async function authorizeCliDeviceSession(
  userCode: string,
  userId: string,
  projectId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeUserCode(userCode);
  if (!normalized) return { ok: false, error: "invalid_code" };

  const project = await getProject(projectId, userId);
  if (!project) return { ok: false, error: "forbidden" };

  const sql = getSql();
  const now = Date.now();
  const sessRows = await sql`
    SELECT id FROM cli_device_sessions
    WHERE user_code = ${normalized} AND status = 'pending' AND expires_at > ${now}
    LIMIT 1
  `;
  const sid = (sessRows[0] as { id: string } | undefined)?.id;
  if (!sid) return { ok: false, error: "invalid_or_expired_code" };

  const keyResult = await createApiKey(projectId, userId);
  if (!keyResult) {
    return { ok: false, error: "key_create_failed" };
  }

  const updated = await sql`
    UPDATE cli_device_sessions
    SET status = 'authorized',
        authorized_at = ${now},
        user_id = ${userId},
        project_id = ${projectId},
        api_key_id = ${keyResult.keyId},
        pending_raw_key = ${keyResult.rawKey},
        result_key_prefix = ${keyResult.keyPrefix}
    WHERE id = ${sid} AND status = 'pending'
    RETURNING id
  `;

  if (!Array.isArray(updated) || updated.length === 0) {
    await deleteApiKey(projectId, keyResult.keyId, userId);
    return { ok: false, error: "session_race" };
  }

  return { ok: true };
}
