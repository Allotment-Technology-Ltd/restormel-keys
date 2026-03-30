/**
 * Project config for Restormel Keys. No secrets — only framework and provider list.
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { resolve, sep } from "path";

export const CONFIG_FILENAME = "restormel.config.json";

export interface RestormelConfig {
  framework?: string;
  providers?: string[];
}

const DEFAULT_CONFIG: RestormelConfig = {
  framework: "none",
  providers: [],
};

function resolveInProject(...segments: string[]): string {
  const base = resolve(process.cwd());
  const target = resolve(base, ...segments);
  if (target !== base && !target.startsWith(`${base}${sep}`)) {
    throw new Error("Path escapes project root");
  }
  return target;
}

export async function readConfig(): Promise<RestormelConfig | null> {
  let path: string;
  try {
    path = resolveInProject(CONFIG_FILENAME);
  } catch {
    return null;
  }
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, "utf-8");
    const data = JSON.parse(raw) as RestormelConfig;
    return { ...DEFAULT_CONFIG, ...data };
  } catch {
    return null;
  }
}

export async function writeConfig(config: RestormelConfig): Promise<void> {
  const path = resolveInProject(CONFIG_FILENAME);
  await writeFile(path, JSON.stringify({ ...DEFAULT_CONFIG, ...config }, null, 2), "utf-8");
}
