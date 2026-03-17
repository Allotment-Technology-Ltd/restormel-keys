/**
 * Project config for Restormel. No secrets — only framework and provider list.
 */
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export const CONFIG_FILENAME = "restormel.config.json";

export interface RestormelConfig {
  framework?: string;
  providers?: string[];
}

const DEFAULT_CONFIG: RestormelConfig = {
  framework: "none",
  providers: [],
};

export async function readConfig(cwd: string): Promise<RestormelConfig | null> {
  const path = join(cwd, CONFIG_FILENAME);
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, "utf-8");
    const data = JSON.parse(raw) as RestormelConfig;
    return { ...DEFAULT_CONFIG, ...data };
  } catch {
    return null;
  }
}

