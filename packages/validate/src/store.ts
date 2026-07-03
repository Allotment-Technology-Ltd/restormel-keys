/**
 * Local key store. Lives under .restormel/ and must be in .gitignore.
 * Contains secrets; validate never prints raw keys.
 */
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { resolve, sep } from "path";

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

function storePath(): string {
  const base = resolve(process.cwd());
  const dir = resolve(base, STORE_DIR);
  if (dir !== base && !dir.startsWith(`${base}${sep}`)) {
    throw new Error("Store directory escapes project root");
  }
  const target = resolve(dir, STORE_FILENAME);
  if (!target.startsWith(`${dir}${sep}`)) {
    throw new Error("Store file escapes project root");
  }
  return target;
}

export async function readStore(): Promise<KeyStoreData> {
  let path: string;
  try {
    path = storePath();
  } catch {
    return { keys: [] };
  }
  if (!existsSync(path)) return { keys: [] };
  try {
    const raw = await readFile(path, "utf-8");
    const data = JSON.parse(raw) as KeyStoreData;
    return Array.isArray(data.keys) ? data : { keys: [] };
  } catch {
    return { keys: [] };
  }
}

