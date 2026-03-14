/**
 * Local key store for CLI. Lives under .restormel/ and must be in .gitignore.
 * Contains secrets; never commit. Config (restormel.config.json) holds no secrets.
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export const STORE_DIR = ".restormel";
export const STORE_FILENAME = "key-store.json";

export interface StoredKey {
  id: string;
  provider: string;
  label?: string;
  /** Masked for display only (e.g. sk-...abc). Never log or expose. */
  mask?: string;
}

export interface KeyStoreData {
  keys: Array<StoredKey & { apiKey: string }>;
}

function storePath(cwd: string): string {
  return join(cwd, STORE_DIR, STORE_FILENAME);
}

export async function readStore(cwd: string): Promise<KeyStoreData> {
  const path = storePath(cwd);
  if (!existsSync(path)) return { keys: [] };
  try {
    const raw = await readFile(path, "utf-8");
    const data = JSON.parse(raw) as KeyStoreData;
    return Array.isArray(data.keys) ? data : { keys: [] };
  } catch {
    return { keys: [] };
  }
}

export async function writeStore(cwd: string, data: KeyStoreData): Promise<void> {
  const dir = join(cwd, STORE_DIR);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(storePath(cwd), JSON.stringify(data, null, 2), "utf-8");
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "***";
  return key.slice(0, 4) + "..." + key.slice(-4);
}
