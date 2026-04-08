import { readFile } from "node:fs/promises";
import { resolvePathUnderRoot } from "@restormel/testing-core";
import YAML from "yaml";
import type { LoadConfigResult } from "./schema.js";
import { validateConfigDocument } from "./validate.js";

export type ConfigStringFormat = "yaml" | "json";

function parseToUnknown(content: string, format: ConfigStringFormat): unknown {
  if (format === "json") {
    return JSON.parse(content) as unknown;
  }
  return YAML.parse(content) as unknown;
}

/**
 * Parse and validate config from a string. YAML is preferred on disk; JSON supported for tooling.
 */
export function loadConfigFromString(content: string, format: ConfigStringFormat): LoadConfigResult {
  try {
    const raw = parseToUnknown(content, format);
    return validateConfigDocument(raw);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, errors: [{ path: "", code: "parse", message }] };
  }
}

export type LoadConfigFromFileOptions = {
  /** Directory tree the config path must stay within (default: `process.cwd()`). */
  allowedRoot?: string;
};

/** Infer `yaml` vs `json` from file extension (.json → json, else yaml). */
export async function loadConfigFromFile(
  filePath: string,
  options?: LoadConfigFromFileOptions,
): Promise<LoadConfigResult> {
  const root = options?.allowedRoot ?? process.cwd();
  const resolved = resolvePathUnderRoot(root, filePath);
  if (!resolved.ok) {
    return { ok: false, errors: [{ path: filePath, code: "io", message: resolved.reason }] };
  }
  const absolutePath = resolved.path;
  const lower = absolutePath.toLowerCase();
  const format: ConfigStringFormat = lower.endsWith(".json") ? "json" : "yaml";
  let content: string;
  try {
    content = await readFile(absolutePath, "utf8");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, errors: [{ path: absolutePath, code: "io", message }] };
  }
  return loadConfigFromString(content, format);
}
