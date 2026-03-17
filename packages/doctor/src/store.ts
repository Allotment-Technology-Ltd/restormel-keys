/**
 * Local key store. Lives under .restormel/ and must be in .gitignore.
 * Contains secrets; never commit. Doctor never prints raw keys.
 */
import { readFile } from "fs/promises";
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

