import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

/** CLI package version (from `packages/cli/package.json`). */
export function cliPackageVersion(): string {
  const raw = readFileSync(join(dir, "..", "package.json"), "utf8");
  return (JSON.parse(raw) as { version: string }).version;
}
